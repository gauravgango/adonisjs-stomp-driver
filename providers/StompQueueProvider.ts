// import { w3cwebsocket } from 'websocket'
import { IocContract } from '@adonisjs/fold'
import { StompManagerContract } from '@ioc:Gaurav/Adonis/Addons/Stomp'

// Object.assign(global, { WebSocket: w3cwebsocket })

/**
 * Provider to bind redis to the container
 */
export default class StompQueueProvider {
	constructor(protected container: IocContract) {}

	/**
	 * Register the redis binding
	 */
	public register() {
		this.container.singleton('Gaurav/Adonis/Addons/Stomp', () => {
			const config = this.container.use('Adonis/Core/Config').get('stomp', {})
			const emitter = this.container.use('Adonis/Core/Event')
			const { StompManager } = require('../src/StompManager')

			return new StompManager(this.container, config, emitter)
		})
	}

	/**
	 * Registering the health check checker with HealthCheck service
	 */
	public boot() {
		this.container.with(
			['Adonis/Core/HealthCheck', 'Gaurav/Adonis/Addons/Stomp'],
			(HealthCheck, Stomp: StompManagerContract) => {
				if (Stomp.healthChecksEnabled) {
					HealthCheck.addChecker('stomp', 'Gaurav/Adonis/Addons/Stomp')
				}
			}
		)
	}

	/**
	 * Gracefully shutdown connections when app goes down
	 */
	public async shutdown() {
		const Stomp: StompManagerContract = this.container.use('Gaurav/Adonis/Addons/Stomp')
		await Stomp.quitAll()
	}
}
