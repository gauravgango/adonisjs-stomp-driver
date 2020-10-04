/// <reference path="../../adonis-typings/stomp.ts" />

import {
	HealthReportNode,
	PubSubChannelHandler,
	StompConnectionConfig,
} from '@ioc:Gaurav/Adonis/Addons/Stomp'
import { Client, messageCallbackType, StompSubscription } from '@stomp/stompjs'
import { EventEmitter } from 'events'
import { Exception } from '@poppinss/utils'
import { IocContract, IocResolverContract } from '@adonisjs/fold'

/**
 * Helper to sleep
 */
const sleep = () => new Promise((resolve) => setTimeout(resolve, 1000))

export abstract class AbstractConnection<
	T extends Client = Client,
	U extends StompSubscription = StompSubscription
> extends EventEmitter {
	/**
	 * Reference to main client connection
	 */
	public ioConnection: T

	/**
	 * Number of times `getReport` was deferred, at max we defer it for 3 times
	 */
	private deferredReportAttempts = 0

	/**
	 * The last error emitted by the `error` event. We set it to `null` after
	 * the `ready` event
	 */
	private lastError?: any

	/**
	 * IoCResolver to resolve bindings
	 */
	private resolver: IocResolverContract

	/**
	 * A list of active subscription and pattern subscription
	 */
	protected subscriptions: Map<string, U[]> = new Map()

	/**
	 * Returns an anonymous function by parsing the IoC container
	 * binding.
	 */
	private resolveIoCBinding(handler: string): PubSubChannelHandler {
		return (...args: any[]) => {
			return this.resolver.call<any>(handler, undefined, args)
		}
	}

	/**
	 * Returns status of the main connection
	 */
	public get status(): boolean {
		return this.ioConnection.active
	}

	constructor(
		public connectionName: string,
		protected config: StompConnectionConfig,
		container: IocContract
	) {
		super()
		this.resolver = container.getResolver(undefined, 'stompListeners', 'App/Listeners')
	}

	/**
	 * The events proxying is required, since ioredis itself doesn't cleanup
	 * listeners after closing the redis connection and since closing a
	 * connection is an async operation, we have to wait for the `end`
	 * event on the actual connection and then remove listeners.
	 */
	protected proxyConnectionEvents() {
		this.ioConnection.onConnect = () => {
			/**
			 * We must set the error to null when server is ready for accept
			 * subscription/publish actions
			 */
			this.lastError = null
			this.emit('connected', this)
		}

		this.ioConnection.onStompError = (error) => {
			this.lastError = error
			this.emit('error', this, error)
		}

		/**
		 * On end, we must cleanup client and self listeners
		 */
		this.ioConnection.onDisconnect = async () => {
			this.emit('end', this)
			this.removeAllListeners()
		}

		this.ioConnection.activate()
	}

	/**
	 * Gracefully end the stomp connection
	 */
	public async quit() {
		for (const [subscriptionName] of this.subscriptions.entries()) {
			this.unsubscribe(subscriptionName)
		}
		await this.emit('disconnected', this)
		await this.ioConnection.deactivate()
	}

	/**
	 * Forcefully end the redis connection
	 */
	public async disconnect() {
		await this.ioConnection.forceDisconnect()
		this.emit('force-disconnected', this)
		await this.quit()
	}

	/**
	 * Subscribe to a given channel to receive Stomp pub/sub events. A
	 * new subscriber connection will be created/managed automatically.
	 */
	public subscribe(channel: string, handler: PubSubChannelHandler): void {
		/**
		 * Disallow multiple subscriptions to a single channel
		 */
		if (this.subscriptions.has(channel)) {
			throw new Exception(
				`"${channel}" channel already has an active subscription`,
				500,
				'E_MULTIPLE_STOMP_SUBSCRIPTIONS'
			)
		}

		/**
		 * If the subscriptions map is empty, it means we have no active subscriptions
		 * on the given channel, hence we should make one subscription and also set
		 * the subscription handler.
		 */
		const connection = this.ioConnection
		const subscriptions: StompSubscription[] = []

		for (let worker = 1; worker >= (this.config.workers || 1); worker++) {
			const subscription = connection.subscribe(
				channel,
				(message) => {
					try {
						if (typeof handler === 'string') {
							handler = this.resolveIoCBinding(handler) as messageCallbackType
						}
						handler(message)
						message.ack()
					} catch (e) {
						message.nack()
					}
				},
				{ ack: 'client' }
			)
			this.emit('subscription:connected', this, worker)
			subscriptions.push(subscription)
		}
		this.subscriptions.set(channel, subscriptions as U[])
	}

	/**
	 * Unsubscribe from a channel
	 */
	public unsubscribe(channel: string) {
		this.subscriptions.get(channel)?.forEach((subscription, index) => {
			subscription.unsubscribe()
			this.emit('subscription:disconnected', this, index + 1)
		})
		this.subscriptions.delete(channel)
	}

	/**
	 * Returns report for the connection
	 */
	public async getReport(): Promise<HealthReportNode> {
		const connection = this.ioConnection

		/**
		 * When status === 'connecting' we maximum wait for 3 times and then send
		 * the report. Which means, if we are unable to connect to redis within
		 * 3 seconds, we consider the connection unstable.
		 */
		if (!connection.connected && this.deferredReportAttempts < 3 && !this.lastError) {
			await sleep()
			this.deferredReportAttempts++
			return this.getReport()
		}

		return {
			connection: this.connectionName,
			active: connection.active,
			connected: connection.connected,
			error: this.lastError,
		}
	}

	/**
	 * Publish message on channel
	 */
	public publish(destination: string, data: any): void {
		return this.ioConnection.publish({
			destination,
			body: JSON.stringify(data),
		})
	}
}
