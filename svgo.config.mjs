const config = {
  multipass: true,
  plugins: [
    'preset-default',
    'removeDimensions',
    { name: 'removeAttrs', params: { attrs: '(data-.*)' } },
  ],
};

export default config;
