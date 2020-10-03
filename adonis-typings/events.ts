declare module '@ioc:Adonis/Core/Event' {
	import { StompConnectionContract } from '@ioc:Gaurav/Adonis/Addons/Stomp'

	interface EventList {
		'adonis:stomp:connected': { connection: StompConnectionContract }
		'adonis:stomp:error': { error: any; connection: StompConnectionContract }
		'adonis:stomp:end': { connection: StompConnectionContract }
		'adonis:stomp:subscriber:connected': { connection: StompConnectionContract; worker: number }
		'adonis:stomp:subscriber:disconnected': { connection: StompConnectionContract; worker: number }
	}
}
