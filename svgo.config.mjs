export default {
  multipass: true,
  plugins: [
    'preset-default',
    'removeDimensions',
    { name: 'removeAttrs', params: { attrs: '(data-.*)' } },
  ],
};
