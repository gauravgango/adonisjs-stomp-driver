import { join } from 'path'
import * as sinkStatic from '@adonisjs/sink'
import { ApplicationContract } from '@ioc:Adonis/Core/Application'

/**
 * Returns absolute path to the stub relative from the templates
 * directory
 */
function getStub(...relativePaths: string[]) {
	return join(__dirname, 'templates', ...relativePaths)
}

/**
 * Instructions to be executed when setting up the package.
 */
export default async function instructions(
	projectRoot: string,
	app: ApplicationContract,
	sink: typeof sinkStatic
) {
	/**
	 * Create Config file
	 */
	const configPath = app.configPath('stomp.ts')
	new sink.files.MustacheFile(projectRoot, configPath, getStub('config.txt'))

	const configDir = app.directoriesMap.get('config') || 'config'
	sink.logger.create(`${configDir}/stomp.ts`)

	/**
	 * Create Contract file
	 */
	const contractPath = app.makePath('contracts/stomp.ts')
	new sink.files.MustacheFile(projectRoot, contractPath, getStub('contract.txt'))

	const contractDir = app.directoriesMap.get('contracts') || 'contracts'
	sink.logger.create(`${contractDir}/stomp.ts`)

	/**
	 * Setup .env file
	 */
	const env = new sink.files.EnvFile(projectRoot)
	env.set('STOMP_CONNECTION', 'local')

	/**
	 * Define connection setting for local
	 */
	env.set('STOMP_HOST', '127.0.0.1')
	env.set('STOMP_PORT', '61616')

	env.commit()
	sink.logger.success('.env')

	sink.logger.success('Packages installed!')
}
