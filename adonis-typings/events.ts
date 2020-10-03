declare module '@ioc:Adonis/Core/Event' {
	interface EventList {
		'adonis:stomp:connected': any
		'adonis:stomp:error': { error: any; connection: any }
		'adonis:stomp:end': any
		'adonis:stomp:subscriber:connected': any
	}
}
