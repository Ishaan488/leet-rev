const path = require('path');

module.exports = {
  entry: './popup.js',  // The entry point (your main JS file)
  output: {
    filename: 'bundle.js',  // The name of the output bundle
    path: path.resolve(__dirname, './'),  // Output directory
  },
  mode: 'production',  // Change to 'production' for optimized build
};
