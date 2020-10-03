import { AbstractConnection } from '../AbstractConnection'
import { Client, StompSubscription } from '@stomp/stompjs/bundles/stomp.umd'
import { StompConnectionConfig, StompConnectionContract } from '@ioc:Gaurav/Adonis/Addons/Stomp'
import { IocContract } from '@adonisjs/fold'

interface StompConfig extends StompConnectionConfig {
	brokerURL?: string
}

export class StompConnection
	extends AbstractConnection<Client, StompSubscription>
	implements StompConnectionContract {
	constructor(
		public connectionName: string,
		protected config: StompConfig,
		container: IocContract
	) {
		super(connectionName, config, container)

		// @Todo handle ssl connection
		this.config.brokerURL = `tcp://${this.config.host}:${this.config.port}`
		this.ioConnection = new Client(this.config)
	}
}
