import { AbstractConnection } from '../AbstractConnection'
import { StompConnectionConfig, StompConnectionContract } from '@ioc:Gaurav/Adonis/Addons/Stomp'
import { IocContract } from '@adonisjs/fold'
const Stomp = require('@stomp/stompjs')
Object.assign(global, { WebSocket: require('websocket').w3cwebsocket })
interface StompConfig extends StompConnectionConfig {
	brokerURL?: string
}

export class StompConnection extends AbstractConnection implements StompConnectionContract {
	constructor(
		public connectionName: string,
		protected config: StompConfig,
		container: IocContract
	) {
		super(connectionName, config, container)

		this.config.brokerURL = `tcp://${this.config.host}:${this.config.port}`
		this.ioConnection = new Stomp.Client(this.config)
		this.proxyConnectionEvents()
	}
}
