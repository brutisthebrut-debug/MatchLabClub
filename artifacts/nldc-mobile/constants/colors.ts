/**
 * MatchLab Club mobile palette, branded indigo/pink.
 * Mobile ships as a dark-themed surface by default (the canonical
 * "men using the app at night" experience). The `light` key here is
 * the active palette; values are aligned with the web dark theme so
 * the two surfaces feel like the same brand.
 */
const colors = {
  light: {
    text: "#F1F0FA",
    tint: "#7B5CF5",

    background: "#07061A",          // deep indigo midnight (matches web dark)
    foreground: "#F1F0FA",

    card: "#0F0D26",
    cardForeground: "#F1F0FA",
    cardBorder: "#1F1B40",

    primary: "#7B5CF5",             // luminous indigo
    primaryForeground: "#07061A",

    secondary: "#1B1740",
    secondaryForeground: "#E1DEF5",

    muted: "#15122F",
    mutedForeground: "#8782B5",

    accent: "#FF4FA8",              // hot pink
    accentForeground: "#FFFFFF",

    destructive: "#FF5C6B",
    destructiveForeground: "#FFFFFF",

    border: "#1F1B40",
    input: "#1B1740",

    gold: "#FF4FA8",                // brand pink replaces neutral gold for accents
    rose: "#FF4FA8",
    teal: "#5BC2D6",
    violet: "#7B5CF5",
    plum: "#B47AE5",

    success: "#65D49C",
    warning: "#FFB454",
  },

  radius: 14,
};

export default colors;
