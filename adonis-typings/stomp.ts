declare module '@ioc:Gaurav/Adonis/Addons/Stomp' {
	import { HealthReportEntry } from '@ioc:Adonis/Core/HealthCheck'
	import {
		Client,
		messageCallbackType,
		StompConfig as StompClientConfig,
	} from '@stomp/stompjs/bundles/stomp.umd'
	import { EventEmitter } from 'events'

	/**
	 * Pubsub subscriber
	 */
	export type PubSubChannelHandler = messageCallbackType | string

	/**
	 * Stomp pub/sub methods
	 */
	export interface StompPubSubContract {
		subscribe(channel: string, handler: PubSubChannelHandler | string): void

		unsubscribe(channel: string): void

		publish(channel: string, data: any): void
	}

	/**
	 * Standard Stomp Connection
	 */
	export interface StompConnectionContract extends StompPubSubContract, EventEmitter {
		status: boolean
		connectionName: string
		ioConnection: Client

		disconnect(): Promise<void>

		getReport(): Promise<HealthReportNode>

		quit(): Promise<void>
	}

	/**
	 * Shape of the report node for the redis connection report
	 */
	export type HealthReportNode = {
		connection: string
		connected: boolean
		active: boolean
		error: any
	}

	export interface StompBaseManagerContract {
		/**
		 * A boolean to know whether health checks have been enabled on one
		 * or more stomp connections or not.
		 */
		healthChecksEnabled: boolean

		/**
		 * Number of active stomp connection.
		 */
		activeConnectionsCount: number
		activeConnections: { [key: string]: StompConnectionContract }

		/**
		 * Fetch a named connection from the defined config inside config/redis file
		 */
		connection(name: string): StompConnectionContract

		/**
		 * Returns the default connection client
		 */
		connection(): StompConnectionContract

		/**
		 * Returns the health check report
		 */
		report(): Promise<HealthReportEntry & { meta: HealthReportNode[] }>

		/**
		 * Quit a named connection.
		 */
		quit<Connection extends keyof StompConnectionsList>(name?: Connection): Promise<void>

		quit(name?: string): Promise<void>

		/**
		 * Forcefully disconnect a named connection.
		 */
		disconnect<Connection extends keyof StompConnectionsList>(name?: Connection): Promise<void>

		disconnect(name?: string): Promise<void>

		/**
		 * Quit all stomp connections
		 */
		quitAll(): Promise<void>

		/**
		 * Disconnect all redis connections
		 */
		disconnectAll(): Promise<void>
	}

	/*
  |--------------------------------------------------------------------------
  | Config
  |--------------------------------------------------------------------------
  */
	/**
	 * Shape of standard Redis connection config
	 */
	export type StompConnectionConfig = Omit<StompClientConfig, 'brokerURL'> & {
		healthCheck?: boolean
		port: string | number
		host: string
		workers?: number
	}

	/**
	 * A list of typed connections defined in the user land using
	 * the contracts file
	 */
	export interface StompConnectionsList extends StompConnectionConfig {}

	/**
	 * Define the config properties on this interface and they will appear
	 * everywhere.
	 */
	export interface StompConfig {
		connection: string
		connections: { [key: string]: StompConnectionsList }
	}

	/**
	 * Redis manager proxies all IO methods on the connection
	 */
	export interface StompManagerContract extends StompBaseManagerContract, StompPubSubContract {}

	const Stomp: StompManagerContract
	export default Stomp
}
