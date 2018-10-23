import typescript from 'rollup-plugin-typescript';
import pkg from './package.json';

const version = process.env.VERSION || pkg.version

const banner =
  '/*!\n' +
  ' * ExoModel.js v' + version + '\n' +
  ' * (c) ' + new Date().getFullYear() + ' Cognito LLC\n' +
  ' * Released under the MIT License.\n' +
  ' */'

export default [
	// UMD (for browsers) build
	{
		input: 'src/main.ts',
		output: {
			name: 'exomodel',
			file: pkg.browser,
			format: 'umd',
			banner: banner
		},
		plugins: [
			typescript()
		]
	},

	// CommonJS (for Node) and ES module (for bundlers) build
	{
		input: 'src/main.ts',
		external: [],
		output: [
			{ file: pkg.main, format: 'cjs', banner: banner },
			{ file: pkg.module, format: 'es', banner: banner }
		],
		plugins: [
			typescript()
		]
	}
];
