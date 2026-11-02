/** Colors come from CSS variables in src/styles/themes.css (see Settings → Appearance). */
export default {
  "darkMode": "class",
  "content": [
    "./index.html",
    "./src/**/*.{ts,tsx}"
  ],
  "theme": {
    "extend": {
      "colors": {
        "surface-container-high": "rgb(var(--c-surface-container-high) / <alpha-value>)",
        "on-secondary": "rgb(var(--c-on-secondary) / <alpha-value>)",
        "on-surface": "rgb(var(--c-on-surface) / <alpha-value>)",
        "surface-container-highest": "rgb(var(--c-surface-container-highest) / <alpha-value>)",
        "error-container": "rgb(var(--c-error-container) / <alpha-value>)",
        "secondary-fixed": "rgb(var(--c-secondary-fixed) / <alpha-value>)",
        "surface": "rgb(var(--c-surface) / <alpha-value>)",
        "on-tertiary-container": "rgb(var(--c-on-tertiary-container) / <alpha-value>)",
        "surface-tint": "rgb(var(--c-surface-tint) / <alpha-value>)",
        "surface-bright": "rgb(var(--c-surface-bright) / <alpha-value>)",
        "tertiary-container": "rgb(var(--c-tertiary-container) / <alpha-value>)",
        "on-primary-container": "rgb(var(--c-on-primary-container) / <alpha-value>)",
        "on-background": "rgb(var(--c-on-background) / <alpha-value>)",
        "outline-variant": "rgb(var(--c-outline-variant) / <alpha-value>)",
        "primary-container": "rgb(var(--c-primary-container) / <alpha-value>)",
        "surface-dim": "rgb(var(--c-surface-dim) / <alpha-value>)",
        "surface-container": "rgb(var(--c-surface-container) / <alpha-value>)",
        "primary-fixed-dim": "rgb(var(--c-primary-fixed-dim) / <alpha-value>)",
        "on-tertiary": "rgb(var(--c-on-tertiary) / <alpha-value>)",
        "tertiary": "rgb(var(--c-tertiary) / <alpha-value>)",
        "tertiary-fixed-dim": "rgb(var(--c-tertiary-fixed-dim) / <alpha-value>)",
        "on-primary": "rgb(var(--c-on-primary) / <alpha-value>)",
        "on-secondary-container": "rgb(var(--c-on-secondary-container) / <alpha-value>)",
        "error": "rgb(var(--c-error) / <alpha-value>)",
        "surface-container-low": "rgb(var(--c-surface-container-low) / <alpha-value>)",
        "on-error": "rgb(var(--c-on-error) / <alpha-value>)",
        "on-surface-variant": "rgb(var(--c-on-surface-variant) / <alpha-value>)",
        "on-tertiary-fixed-variant": "rgb(var(--c-on-tertiary-fixed-variant) / <alpha-value>)",
        "inverse-surface": "rgb(var(--c-inverse-surface) / <alpha-value>)",
        "outline": "rgb(var(--c-outline) / <alpha-value>)",
        "primary": "rgb(var(--c-primary) / <alpha-value>)",
        "secondary": "rgb(var(--c-secondary) / <alpha-value>)",
        "primary-fixed": "rgb(var(--c-primary-fixed) / <alpha-value>)",
        "secondary-fixed-dim": "rgb(var(--c-secondary-fixed-dim) / <alpha-value>)",
        "secondary-container": "rgb(var(--c-secondary-container) / <alpha-value>)",
        "surface-variant": "rgb(var(--c-surface-variant) / <alpha-value>)",
        "on-primary-fixed": "rgb(var(--c-on-primary-fixed) / <alpha-value>)",
        "inverse-primary": "rgb(var(--c-inverse-primary) / <alpha-value>)",
        "background": "rgb(var(--c-background) / <alpha-value>)",
        "inverse-on-surface": "rgb(var(--c-inverse-on-surface) / <alpha-value>)",
        "on-error-container": "rgb(var(--c-on-error-container) / <alpha-value>)",
        "on-tertiary-fixed": "rgb(var(--c-on-tertiary-fixed) / <alpha-value>)",
        "on-secondary-fixed": "rgb(var(--c-on-secondary-fixed) / <alpha-value>)",
        "on-secondary-fixed-variant": "rgb(var(--c-on-secondary-fixed-variant) / <alpha-value>)",
        "surface-container-lowest": "rgb(var(--c-surface-container-lowest) / <alpha-value>)",
        "tertiary-fixed": "rgb(var(--c-tertiary-fixed) / <alpha-value>)",
        "on-primary-fixed-variant": "rgb(var(--c-on-primary-fixed-variant) / <alpha-value>)"
      },
      "borderRadius": {
        "DEFAULT": "0.125rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "2xl": "1rem",
        "3xl": "1.25rem",
        "full": "9999px",
        "circle": "9999px"
      },
      "spacing": {
        "margin-lg": "2rem",
        "gutter-lg": "1.5rem",
        "space-sm": "0.5rem",
        "space-md": "0.75rem",
        "gutter": "1rem",
        "margin": "1rem",
        "space-xl": "2rem",
        "space-xs": "0.25rem",
        "space-lg": "1.25rem"
      },
      "fontFamily": {
        "body-sm": [
          "Inter"
        ],
        "label-md": [
          "Inter"
        ],
        "headline-lg": [
          "Plus Jakarta Sans"
        ],
        "body-lg": [
          "Inter"
        ],
        "code-sm": [
          "JetBrains Mono"
        ],
        "code-md": [
          "JetBrains Mono"
        ],
        "label-sm": [
          "Inter"
        ],
        "headline-md": [
          "Plus Jakarta Sans"
        ],
        "headline-sm": [
          "Plus Jakarta Sans"
        ],
        "headline-xl": [
          "Plus Jakarta Sans"
        ],
        "body-md": [
          "Inter"
        ],
        "headline-xl-mobile": [
          "Plus Jakarta Sans"
        ],
        "sans": [
          "Inter",
          "system-ui",
          "sans-serif"
        ],
        "mono": [
          "JetBrains Mono",
          "ui-monospace",
          "monospace"
        ]
      },
      "fontSize": {
        "body-sm": [
          "13px",
          {
            "lineHeight": "18px",
            "fontWeight": "400"
          }
        ],
        "label-md": [
          "12px",
          {
            "lineHeight": "16px",
            "fontWeight": "500"
          }
        ],
        "headline-lg": [
          "24px",
          {
            "lineHeight": "32px",
            "fontWeight": "600"
          }
        ],
        "body-lg": [
          "16px",
          {
            "lineHeight": "26px",
            "fontWeight": "400"
          }
        ],
        "code-sm": [
          "11px",
          {
            "lineHeight": "16px",
            "fontWeight": "500"
          }
        ],
        "code-md": [
          "13px",
          {
            "lineHeight": "20px",
            "fontWeight": "400"
          }
        ],
        "label-sm": [
          "11px",
          {
            "lineHeight": "14px",
            "fontWeight": "500"
          }
        ],
        "headline-md": [
          "18px",
          {
            "lineHeight": "26px",
            "fontWeight": "600"
          }
        ],
        "headline-sm": [
          "15px",
          {
            "lineHeight": "22px",
            "fontWeight": "600"
          }
        ],
        "headline-xl": [
          "32px",
          {
            "lineHeight": "40px",
            "fontWeight": "700"
          }
        ],
        "body-md": [
          "14px",
          {
            "lineHeight": "22px",
            "fontWeight": "400"
          }
        ],
        "headline-xl-mobile": [
          "26px",
          {
            "lineHeight": "32px",
            "fontWeight": "700"
          }
        ]
      }
    }
  }
};
