/// <reference path="../../adonis-typings/stomp.ts" />

import { IocContract } from '@adonisjs/fold'
import { EmitterContract } from '@ioc:Adonis/Core/Event'
import { Exception, ManagerConfigValidator } from '@poppinss/utils'

import {
	HealthReportNode,
	StompBaseManagerContract,
	StompConnectionContract,
	StompConfig,
} from '@ioc:Gaurav/Adonis/Addons/Stomp'

import { StompConnection } from '../StompConnection'

/**
 * Stomp manager exposes the API to interact with a stomp server.
 */
export class StompManager implements StompBaseManagerContract {
	/**
	 * An array of connections with health checks enabled, which means, we always
	 * create a connection for them, even when they are not used.
	 */
	private healthCheckConnections: string[] = []

	/**
	 * A copy of live connections. We avoid re-creating a new connection
	 * everytime and re-use connections.
	 */
	public activeConnections: {
		[key: string]: StompConnectionContract
	} = {}

	/**
	 * A boolean to know whether health checks have been enabled on one
	 * or more redis connections or not.
	 */
	public get healthChecksEnabled() {
		return this.healthCheckConnections.length > 0
	}

	/**
	 * Returns the length of active connections
	 */
	public get activeConnectionsCount() {
		return Object.keys(this.activeConnections).length
	}

	constructor(
		private container: IocContract,
		private config: StompConfig,
		private emitter: EmitterContract
	) {
		this.validateConfig()
		this.healthCheckConnections = Object.keys(this.config.connections).filter(
			(connection) => this.config.connections[connection].healthCheck
		)
	}

	/**
	 * Validate config at runtime
	 */
	private validateConfig() {
		const validator = new ManagerConfigValidator(this.config, 'stomp', 'config/stomp')
		validator.validateDefault('connection')
		validator.validateList('connections', 'connection')
	}

	/**
	 * Returns default connection name
	 */
	private getDefaultConnection(): string {
		return this.config.connection
	}

	/**
	 * Returns an existing connection using it's name or the
	 * default connection,
	 */
	private getExistingConnection(name?: string) {
		name = name || this.getDefaultConnection()
		return this.activeConnections[name]
	}

	/**
	 * Returns config for a given connection
	 */
	private getConnectionConfig(name: string) {
		return this.config.connections[name]
	}

	/**
	 * Returns stomp factory for a given named connection
	 */
	public connection(name?: string): any {
		/**
		 * Using default connection name when actual name is missing
		 */
		name = name || this.getDefaultConnection()

		/**
		 * Return cached connection
		 */
		if (this.activeConnections[name]) {
			return this.activeConnections[name]
		}

		const config = this.getConnectionConfig(name)

		/**
		 * Raise error if config for the given name is missing
		 */
		if (!config) {
			throw new Exception(`Define config for "${name}" connection inside "config/stomp" file`)
		}

		/**
		 * Create connection and store inside the connection pools
		 * object, so that we can re-use it later
		 */
		const connection = (this.activeConnections[name] = new StompConnection(
			name,
			config,
			this.container
		))
		//@todo handle default events
		/**
		 * Stop tracking the connection after it's removed
		 */
		connection.on('end', ($connection) => {
			delete this.activeConnections[$connection.connectionName]
			this.emitter.emit('adonis:redis:end', { connection: $connection })
		})

		/**
		 * Forward ready event
		 */
		connection.on('ready', ($connection) =>
			this.emitter.emit('adonis:redis:ready', { connection: $connection })
		)

		/**
		 * Forward error event
		 */
		connection.on('error', (error, $connection) =>
			this.emitter.emit('adonis:redis:error', { error, connection: $connection })
		)

		/**
		 * Return connection
		 */
		return connection
	}

	/**
	 * Quit a named connection or the default connection when no
	 * name is defined.
	 */
	public async quit(name?: string): Promise<void> {
		const connection = this.getExistingConnection(name)
		if (!connection) {
			return
		}

		return connection.quit()
	}

	/**
	 * Disconnect a named connection or the default connection when no
	 * name is defined.
	 */
	public async disconnect(name?: string): Promise<void> {
		const connection = this.getExistingConnection(name)
		if (!connection) {
			return
		}

		return connection.disconnect()
	}

	/**
	 * Quit all connections
	 */
	public async quitAll(): Promise<void> {
		await Promise.all(Object.keys(this.activeConnections).map((name) => this.quit(name)))
	}

	/**
	 * Disconnect all connections
	 */
	public async disconnectAll(): Promise<void> {
		await Promise.all(Object.keys(this.activeConnections).map((name) => this.disconnect(name)))
	}

	/**
	 * Returns the report for all connections marked for `healthChecks`
	 */
	public async report() {
		const reports = (await Promise.all(
			this.healthCheckConnections.map((connection) => {
				return this.connection(connection).getReport(true)
			})
		)) as HealthReportNode[]

		const healthy = !reports.find((report) => !report.active && !report.connected)
		return {
			displayName: 'Stomp',
			health: {
				healthy,
				message: healthy
					? 'All connections are healthy'
					: 'One or more stomp connections are not healthy',
			},
			meta: reports,
		}
	}
}
