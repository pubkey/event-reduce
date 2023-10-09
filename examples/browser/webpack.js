const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/index.ts',
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
    })
  ],
  module: {
    rules: [{
      test: /\.tsx?$/,
      use: 'ts-loader',
      exclude: /node_modules/
    },
    {
      test: /\.less$/,
      use: [
        {
          loader: 'style-loader',
        },
        {
          loader: 'css-loader',
        },
        {
          loader: 'less-loader',
          options: {
            lessOptions: {
              strictMath: true,
              noIeCompat: true,
            },
          },
        },
      ],
    }]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  optimization: {
    minimize: false
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  mode: 'development'
};
