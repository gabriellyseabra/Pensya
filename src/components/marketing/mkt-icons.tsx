import {
  Target, UserPlus, Award, MessageCircle, Share2, CalendarCheck, Users, School,
  Activity, Megaphone, Heart, TrendingUp, Sparkles, Instagram, GraduationCap,
  type LucideIcon,
} from "lucide-react";

/** Ícones disponíveis para objetivos/indicadores (nome salvo no banco → componente). */
export const MKT_ICON_MAP: Record<string, LucideIcon> = {
  target: Target,
  "user-plus": UserPlus,
  award: Award,
  "message-circle": MessageCircle,
  "share-2": Share2,
  "calendar-check": CalendarCheck,
  users: Users,
  school: School,
  activity: Activity,
  megaphone: Megaphone,
  heart: Heart,
  "trending-up": TrendingUp,
  sparkles: Sparkles,
  instagram: Instagram,
  "graduation-cap": GraduationCap,
};

export const MKT_ICON_OPCOES = Object.keys(MKT_ICON_MAP);

export function MktIcon({ nome, className }: { nome: string | null | undefined; className?: string }) {
  const Icon = (nome && MKT_ICON_MAP[nome]) || Activity;
  return <Icon className={className} />;
}
