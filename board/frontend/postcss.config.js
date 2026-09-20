// PostCSS pipeline for the dashboard styles (src/index.css).
//
// Tailwind is intentionally NOT part of this project: the UI is styled with
// plain CSS (src/index.css) plus inline styles, and no Tailwind utility class
// is used anywhere in the JSX. Autoprefixer is still useful for the vendor
// prefixes that `appearance`, `user-select` and friends need.
export default {
  plugins: {
    autoprefixer: {},
  },
}
