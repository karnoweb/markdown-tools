/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./index.html', './app/js/**/*.js'],
	plugins: [require('daisyui')],
	daisyui: {
		themes: [
			'light',
			'dark',
			'night',
			'dracula',
			'dim',
			'nord',
			'sunset',
			'forest',
			'luxury',
			'coffee',
			'business',
			'halloween',
			'synthwave',
			'black',
			'cyberpunk'
		]
	}
};
