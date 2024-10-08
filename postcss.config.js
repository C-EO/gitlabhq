const path = require('node:path');

module.exports = {
  plugins: {
    tailwindcss: { config: path.join(__dirname, 'config/tailwind.config.js') },
    autoprefixer: {},
  },
};
