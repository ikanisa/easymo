module.exports = {
  // Mirror Next.js' default PostCSS pipeline to keep CSS module support without custom config warnings.
  plugins: [
    'next/dist/compiled/postcss-flexbugs-fixes',
    [
      'next/dist/compiled/postcss-preset-env',
      {
        autoprefixer: { flexbox: 'no-2009' },
        stage: 3,
        features: {
          'custom-properties': false
        }
      }
    ]
  ]
};
