import {
  Heart, Star, Bird, Telescope, Construction, Layers, Zap, Target, PencilLine,
  FolderOpen, Sunrise, Wrench, Sparkles, Flame, Sprout, Compass, Hammer, Waves,
  Disc, Shield, Ruler, Landmark, Megaphone, DoorOpen, Link, TreePine, Music, Gem,
  CircleUser, Wind, Search, Mic, MessageCircle, Square, HeartHandshake, Speech,
  Clock, Hand, Handshake, Gift, Home, Mountain, Anchor, Gauge, ClipboardList,
  Microscope, Cloud, Sun, HeartPulse, Wallet, BarChart3, Briefcase, EyeOff, Leaf,
  Footprints, ArrowRight, Smile, Key, Lock, Pencil, type LucideIcon,
} from "lucide-react";

// Shared lucide icon registry used by the quiz/archetype/style surfaces. Quiz
// results are persisted to localStorage via JSON.stringify, so the data layer
// stores a string key (never a component reference); consumers resolve it here.
// Keep playfulness via per-item color, not emoji.
export const GLYPHS: Record<string, LucideIcon> = {
  Heart, Star, Bird, Telescope, Construction, Layers, Zap, Target, PencilLine,
  FolderOpen, Sunrise, Wrench, Sparkles, Flame, Sprout, Compass, Hammer, Waves,
  Disc, Shield, Ruler, Landmark, Megaphone, DoorOpen, Link, TreePine, Music, Gem,
  CircleUser, Wind, Search, Mic, MessageCircle, Square, HeartHandshake, Speech,
  Clock, Hand, Handshake, Gift, Home, Mountain, Anchor, Gauge, ClipboardList,
  Microscope, Cloud, Sun, HeartPulse, Wallet, BarChart3, Briefcase, EyeOff, Leaf,
  Footprints, ArrowRight, Smile, Key, Lock, Pencil,
};

export function getGlyph(name: string | undefined | null): LucideIcon {
  return (name && GLYPHS[name]) || Sparkles;
}

export function Glyph({
  name,
  className,
  color,
}: {
  name: string | undefined | null;
  className?: string;
  color?: string;
}) {
  const Icon = getGlyph(name);
  return <Icon className={className} style={color ? { color } : undefined} aria-hidden="true" />;
}
