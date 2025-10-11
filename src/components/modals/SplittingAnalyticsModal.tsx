import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Platform,
  FlatList,
  Dimensions,
  Image,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Icon } from '../common/Icon';
import { useAuth } from '@/hooks/useAuth';
import Svg, { Circle, G, Path, Polyline } from 'react-native-svg';
import { ApiService } from '@/services/api/ApiService';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { SplittingService } from '@/services/firebase/splitting-disabled';
import { getCurrencySymbol } from '@/utils/currency';
import CircularLoader from '@/components/common/CircularLoader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Period = 'week' | 'month' | 'quarter' | 'year';

interface GroupMember {
  userId: string;
  balance?: number;
  isActive?: boolean;
  userData?: {
    id?: string;
    fullName?: string;
    email?: string;
    avatar?: string;
  };
}

interface Group {
  id: string;
  name: string;
  members: GroupMember[];
  isActive?: boolean;
  currency?: string;
}

interface ExpenseSplit {
  userId: string;
  amount: number;
  isPaid?: boolean;
  settledAt?: Date;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  paidBy: string;
  paidByData?: {
    fullName?: string;
    email?: string;
    avatar?: string;
  };
  groupId: string;
  currency?: string;
  date: Date;
  createdAt?: Date;
  updatedAt?: Date;
  splitData?: ExpenseSplit[];
}

// Donut chart
function DonutChart({ data, size = 160, stroke = 22 }: { data: Array<{ value: number; color: string }>; size?: number; stroke?: number; }) {
  const sum = Math.max(1, data.reduce((a, d) => a + d.value, 0));
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  let angle = -Math.PI / 2;

  const paths = data.map((d, idx) => {
    const portion = d.value / sum;
    const delta = portion * Math.PI * 2;
    const sx = cx + r * Math.cos(angle);
    const sy = cy + r * Math.sin(angle);
    const end = angle + delta;
    const ex = cx + r * Math.cos(end);
    const ey = cy + r * Math.sin(end);
    const largeArc = delta > Math.PI ? 1 : 0;
    angle = end;
    const p = `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`;
    return <Path key={idx} d={p} stroke={d.color} strokeWidth={stroke} fill="none" strokeLinecap="butt" />;
  });

  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={r} stroke="#F3F4F6" strokeWidth={stroke} fill="none" />
      <G>{paths}</G>
      <Circle cx={cx} cy={cy} r={r - stroke / 2} fill="#FFFFFF" />
    </Svg>
  );
}

// Line chart
function LineChart({ values, width = 322, height = 160, color }: { values: number[]; width?: number; height?: number; color: string; }) {
  const max = Math.max(...values, 1);
  const min = 0;
  const padding = 12;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const stepX = values.length > 1 ? innerW / (values.length - 1) : innerW;

  const pts = values.map((v, i) => {
    const x = padding + i * stepX;
    const y = padding + innerH - ((v - min) / (max - min)) * innerH;
    return [x, y] as const;
  });
  const poly = pts.map(([x, y]) => `${x},${y}`).join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline points={`${padding},${height - padding} ${width - padding},${height - padding}`} stroke="#E5E7EB" strokeWidth={1} />
      <Polyline points={`${padding},${padding} ${padding},${height - padding}`} stroke="#E5E7EB" strokeWidth={1} />
      <Polyline points={poly} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />
      {pts.map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={4} fill={color} />)}
    </Svg>
  );
}

interface Props {
  visible: boolean;
  onClose: () => void;
  initialGroupId?: string;
}

export default function SplittingAnalyticsModal({ visible, onClose, initialGroupId }: Props) {
  const { theme } = useTheme();
  // Force header to bright maroon; keep theme fallbacks for consistency
  const BRAND = theme.colors.brand || '#B0004F';
  const BRAND_LIGHT = theme.colors.brandLight || '#D91A72';
  const BRAND_DARK = theme.colors.brandDark || '#8B003F';
  const SURFACE = theme.colors.surface || '#FFFFFF';
  const BG = theme.colors.backgroundAlt || '#FAF7F6';

  const { user } = useAuth();
  const api = useMemo(() => ApiService.getInstance(), []);
  const [loading, setLoading] = useState(false);

  // Data state
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId ?? null);
  const [groupExpenses, setGroupExpenses] = useState<Expense[]>([]);
  const [period, setPeriod] = useState<Period>('month');

  // UI state
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);

  // Currency: group currency → user currency → USD
  const currencyCode = (groups.find(g => g.id === selectedGroupId)?.currency) || user?.currency || 'USD';
  const C = getCurrencySymbol(currencyCode);

  // Load groups
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!visible || !user?.id) return;
      setLoading(true);
      try {
        let fetched: Group[] = [];
        try {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const res = await api.getUserGroups(user.id);
          fetched = Array.isArray(res) ? res : (res?.groups || []);
        } catch {}
        if (!fetched?.length) {
          try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            fetched = await SplittingService.getUserGroups(user.id);
          } catch {}
        }
        if (cancelled) return;

        const active = (fetched || []).filter(g => g?.isActive !== false);
        setGroups(active);
        if (!selectedGroupId && active.length) setSelectedGroupId(active[0].id);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [visible, user?.id, api]);

  // Load expenses when group changes
  useEffect(() => {
    let cancelled = false;
    async function loadExpenses() {
      if (!visible || !selectedGroupId) return;
      setLoading(true);
      try {
        let expenses: Expense[] = [];
        try {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const res = await api.getGroupExpenses(selectedGroupId);
          expenses = Array.isArray(res) ? res : (res?.expenses || []);
        } catch {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          expenses = await SplittingService.getGroupExpenses(selectedGroupId);
        }
        if (cancelled) return;

        const normalized = (expenses || []).map((e: any) => ({
          ...e,
          date: e.date ? new Date(e.date) : (e.createdAt ? new Date(e.createdAt) : new Date()),
        }));
        setGroupExpenses(normalized as Expense[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadExpenses();
  }, [visible, selectedGroupId, api]);

  // Derived
  const selectedGroup = useMemo(() => groups.find(g => g.id === selectedGroupId) || null, [groups, selectedGroupId]);
  const activeMemberCount = useMemo(
    () => (selectedGroup?.members || []).filter(m => m.isActive !== false).length || (selectedGroup?.members?.length || 1),
    [selectedGroup]
  );

  // Period window
  const range = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (period === 'week') start.setDate(now.getDate() - 7);
    if (period === 'month') start.setMonth(now.getMonth() - 1);
    if (period === 'quarter') start.setMonth(now.getMonth() - 3);
    if (period === 'year') start.setFullYear(now.getFullYear() - 1);
    return { start, end: now };
  }, [period]);

  const filtered = useMemo(() => groupExpenses.filter(e => e.date >= range.start && e.date <= range.end), [groupExpenses, range]);
  const nonSettlement = useMemo(() => filtered.filter(e => (e.category || '').toLowerCase() !== 'settlement'), [filtered]);

  // KPIs
  const totalGroupSpend = useMemo(() => nonSettlement.reduce((sum, e) => sum + (e.amount || 0), 0), [nonSettlement]);
  const avgPerPerson = useMemo(() => (activeMemberCount ? totalGroupSpend / activeMemberCount : totalGroupSpend), [totalGroupSpend, activeMemberCount]);

  // Category mapping (icons + colors) - case-insensitive
  const CATEGORY_ICON: Record<string, string> = {
    coffee: '☕', groceries: '🛒', dining: '🍽️', 'food & dining': '🍽️', food: '🍕',
    transport: '🚗', transportation: '🚗', entertainment: '🎬', shopping: '🛍️',
    bills: '💡', utilities: '⚡', gas: '⛽', healthcare: '🏥', housing: '🏠',
    education: '📚', travel: '✈️', settlement: '💸', other: '💳',
  };
  const CATEGORY_COLOR: Record<string, string> = {
    coffee: '#f59e0b', groceries: '#10b981', dining: '#ef4444', 'food & dining': '#ef4444', food: '#F59E0B',
    transport: '#3b82f6', transportation: '#3b82f6', entertainment: '#8b5cf6', shopping: '#ec4899',
    bills: '#f97316', utilities: '#f59e0b', gas: '#64748b', healthcare: '#06b6d4', travel: '#06b6d4',
    housing: '#7c3aed', education: '#6366f1', settlement: '#10b981', other: '#6b7280',
  };

  const categoryBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of nonSettlement) {
      const key = (e.category || 'other').toLowerCase();
      m.set(key, (m.get(key) || 0) + (e.amount || 0));
    }
    const arr = Array.from(m.entries()).map(([category, amount]) => {
      const lowerCategory = category.toLowerCase();
      const color = CATEGORY_COLOR[lowerCategory] || BRAND;
      const icon = CATEGORY_ICON[lowerCategory] || '💳';
      return { category, amount, color, icon };
    });
    const grand = arr.reduce((s, it) => s + it.amount, 0) || 1;
    const result = arr
      .sort((a, b) => b.amount - a.amount)
      .map(it => ({ ...it, percentage: (it.amount / grand) * 100 }));

    // Debug log to see what icons we're getting
    console.log('📊 Category breakdown:', result.map(r => ({ cat: r.category, icon: r.icon })));

    return result;
  }, [nonSettlement, BRAND, CATEGORY_ICON, CATEGORY_COLOR]);

  // Top spenders
  const topSpenders = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of nonSettlement) {
      m.set(e.paidBy, (m.get(e.paidBy) || 0) + (e.amount || 0));
    }
    const withNames = Array.from(m.entries()).map(([userId, amount]) => {
      const member = selectedGroup?.members?.find(mb => mb.userId === userId);
      const name = member?.userData?.fullName || nonSettlement.find(x => x.paidBy === userId)?.paidByData?.fullName || 'Unknown';
      return { userId, name, amount };
    });
    return withNames.sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [nonSettlement, selectedGroup?.members]);

  // Trend series
  const trendSeries = useMemo(() => {
    const now = new Date();
    if (period === 'week') {
      const days = [...Array(7)].map((_, i) => {
        const d = new Date(now);
        d.setDate(now.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);
        return d;
      });
      const vals = days.map((d) => {
        const next = new Date(d); next.setDate(d.getDate() + 1);
        return filtered
          .filter(e => e.date >= d && e.date < next && (e.category || '').toLowerCase() !== 'settlement')
          .reduce((s, e) => s + e.amount, 0);
      });
      const labels = days.map(d => d.toLocaleDateString(undefined, { weekday: 'short' }));
      return { labels, values: vals };
    }
    if (period === 'month') {
      const labels: string[] = [];
      const values: number[] = [];
      for (let i = 3; i >= 0; i--) {
        const start = new Date(now);
        start.setDate(now.getDate() - i * 7);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        const sum = filtered
          .filter(e => e.date >= start && e.date < end && (e.category || '').toLowerCase() !== 'settlement')
          .reduce((s, e) => s + e.amount, 0);
        labels.push(`W${4 - i}`);
        values.push(sum);
      }
      return { labels, values };
    }
    if (period === 'quarter') {
      const labels: string[] = [];
      const values: number[] = [];
      for (let i = 11; i >= 0; i--) {
        const start = new Date(now);
        start.setDate(now.getDate() - i * 7);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        const sum = filtered
          .filter(e => e.date >= start && e.date < end && (e.category || '').toLowerCase() !== 'settlement')
          .reduce((s, e) => s + e.amount, 0);
        labels.push(`W${12 - i}`);
        values.push(sum);
      }
      return { labels, values };
    }
    const labels: string[] = [];
    const values: number[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const sum = filtered
        .filter(e => e.date >= d && e.date < end && (e.category || '').toLowerCase() !== 'settlement')
        .reduce((s, e) => s + e.amount, 0);
      labels.push(d.toLocaleString(undefined, { month: 'short' }));
      values.push(sum);
    }
    return { labels, values };
  }, [filtered, period]);

  // Settlement insights
  const settlementInsights = useMemo(() => {
    function daysSince(d: Date) { return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)); }
    function medianDays(arr: number[]) {
      const a = [...arr].sort((x, y) => x - y);
      const mid = Math.floor(a.length / 2);
      return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
    }
    function rankStatus(s: 'fast' | 'on-time' | 'late') { return s === 'fast' ? 0 : s === 'on-time' ? 1 : 2; }

    const insights: { name: string; avatar?: string; status: 'fast' | 'on-time' | 'late'; note: string }[] = [];
    const members = selectedGroup?.members || [];
    for (const m of members) {
      const name = m.userData?.fullName || 'Member';
      const avatar = m.userData?.avatar;
      const owed: { created: Date; settled?: Date; isPaid?: boolean }[] = [];
      for (const e of (groupExpenses || [])) {
        if (!e.splitData || (e.category || '').toLowerCase() === 'settlement') continue;
        const s = e.splitData.find(sd => sd.userId === m.userId);
        if (!s) continue;
        owed.push({
          created: e.date || e.createdAt || new Date(),
          settled: s.settledAt ? new Date(s.settledAt) : undefined,
          isPaid: s.isPaid,
        });
      }
      const days: number[] = owed
        .filter(x => (x.isPaid && x.settled) || x.settled)
        .map(x => {
          const end = x.settled ?? new Date();
          const ms = end.getTime() - x.created.getTime();
          return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
        });
      let status: 'fast' | 'on-time' | 'late' = 'on-time';
      let note = 'Typically on time';
      if (days.length > 0) {
        const median = medianDays(days);
        if (median <= 2) { status = 'fast'; note = `Settles in ~${median} days`; }
        else if (median >= 7) { status = 'late'; note = `Often takes ${median}+ days`; }
        else { status = 'on-time'; note = `Usually ${median}–6 days`; }
      } else {
        const overdue = owed.filter(x => !x.isPaid && daysSince(x.created) > 7).length;
        if (overdue === 0) { status = 'fast'; note = 'No overdue splits'; }
        else if (overdue <= 2) { status = 'on-time'; note = 'Occasional delays'; }
        else { status = 'late'; note = 'Multiple overdue splits'; }
      }
      insights.push({ name, avatar, status, note });
    }
    return insights.sort((a, b) => rankStatus(a.status) - rankStatus(b.status)).slice(0, 5);
  }, [groupExpenses, selectedGroup?.members]);

  // Group totals for picker
  const [groupTotals, setGroupTotals] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    async function preloadTotals() {
      if (!visible || !groups.length) return;
      const entries = await Promise.all(
        groups.map(async (g) => {
          try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const res = await api.getGroupExpenses(g.id);
            const expenses: Expense[] = Array.isArray(res) ? res : (res?.expenses || []);
            const total = expenses
              .filter(e => (e.category || '').toLowerCase() !== 'settlement')
              .reduce((s, e) => s + (e.amount || 0), 0);
            return [g.id, total] as const;
          } catch {
            try {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              const legacy: Expense[] = await SplittingService.getGroupExpenses(g.id);
              const total = legacy
                .filter(e => (e.category || '').toLowerCase() !== 'settlement')
                .reduce((s, e) => s + (e.amount || 0), 0);
              return [g.id, total] as const;
            } catch {
              return [g.id, 0] as const;
            }
          }
        })
      );
      if (!cancelled) {
        const m: Record<string, number> = {};
        for (const [id, total] of entries) m[id] = total;
        setGroupTotals(m);
      }
    }
    preloadTotals();
    return () => { cancelled = true; };
  }, [visible, groups, api]);

  const periodItems: { key: Period; label: string }[] = [
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'quarter', label: 'Quarter' },
    { key: 'year', label: 'Year' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: BG }]}>
        {/* Bright maroon header with centered dropdown and white back arrow */}
        <View style={[styles.heroHeader, { backgroundColor: BRAND }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Icon name="back" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setGroupPickerOpen(true)}
              style={styles.centerTitle}
            >
              <Text style={styles.centerTitleText} numberOfLines={1}>
                {selectedGroup?.name || 'Select Group'}
              </Text>
              <Text style={{ color: '#FFFFFF', fontSize: 16, marginLeft: 4 }}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        {loading && !groupExpenses.length ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <CircularLoader size={60} />
            <Text style={{ fontSize: 16, fontWeight: '500', marginTop: 16, color: '#3bf6ceff' }}>
              Loading analytics...
            </Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
            {/* KPIs */}
            <View style={styles.kpiRow}>
              <View style={[styles.kpiCard, { backgroundColor: SURFACE }]}>
                <Text style={styles.kpiLabel}>Total Group Spend</Text>
                <Text style={[styles.kpiValue, { color: BRAND }]}>{C}{totalGroupSpend.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: SURFACE }]}>
                <Text style={styles.kpiLabel}>Avg. Spend Per Person</Text>
                <Text style={[styles.kpiValue, { color: '#10B981' }]}>{C}{avgPerPerson.toFixed(2)}</Text>
              </View>
            </View>

            {/* Period control */}
            <View style={[styles.segmentContainer, { backgroundColor: SURFACE, borderColor: '#EEE8EA' }]}>
              {periodItems.map(p => {
                const active = p.key === period;
                return (
                  <TouchableOpacity key={p.key} style={[styles.segmentItem, active && { backgroundColor: BRAND }]} onPress={() => setPeriod(p.key)}>
                    <Text style={[styles.segmentText, active && { color: '#FFF' }]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Spending Categories */}
            <View style={[styles.card, { backgroundColor: SURFACE }]}>
              <Text style={styles.cardTitle}>Spending Categories</Text>
              <Text style={styles.cardSub}>Breakdown by category</Text>
              <View style={styles.donutRow}>
                <DonutChart
                  data={categoryBreakdown.map(c => ({ value: c.amount, color: c.color || BRAND }))}
                  size={140}
                  stroke={20}
                />
                <View style={styles.legendCol}>
                  {categoryBreakdown.slice(0, 5).map((c, idx) => (
                    <View key={idx} style={styles.legendItem}>
                      <Text style={styles.legendIcon}>{c.icon}</Text>
                      <View style={[styles.legendDot, { backgroundColor: c.color }]} />
                      <Text style={styles.legendText} numberOfLines={1}>
                        {c.category}
                      </Text>
                      <Text style={[styles.legendPct, { color: c.color }]}>
                        {c.percentage.toFixed(0)}%
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Settlement Insights */}
            <View style={[styles.card, { backgroundColor: SURFACE }]}>
              <Text style={styles.cardTitle}>Settlement Insights</Text>
              <Text style={styles.cardSub}>Who settles expenses faster or slower?</Text>
              <View style={{ marginTop: 8 }}>
                {settlementInsights.map((r, i) => {
                  const color = r.status === 'fast' ? '#10B981' : r.status === 'on-time' ? '#9CA3AF' : '#F43F5E';
                  const label = r.status === 'fast' ? 'Fast' : r.status === 'on-time' ? 'On-Time' : 'Often Late';
                  return (
                    <View key={`${r.name}-${i}`} style={styles.settleRow}>
                      {r.avatar ? (
                        <Image source={{ uri: r.avatar }} style={styles.avatarImg} />
                      ) : (
                        <View style={[styles.avatar, { backgroundColor: BRAND }]}>
                          <Text style={styles.avatarText}>{(r.name || '?').charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settleName}>{r.name}</Text>
                        <Text style={styles.settleNote}>{r.note}</Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: color }]}>
                        <Text style={styles.badgeText}>{label}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Top Spenders */}
            <View style={[styles.card, { backgroundColor: SURFACE }]}>
              <Text style={styles.cardTitle}>Top Spenders</Text>
              <Text style={styles.cardSub}>Who spent the most this period</Text>
              <View style={{ marginTop: 8 }}>
                {topSpenders.map((p, i) => {
                  const palette = [BRAND, BRAND_LIGHT, BRAND_DARK, '#C84C7D', '#E3A7C1'];
                  const color = palette[i] || BRAND;
                  const pct = p.amount / Math.max(1, topSpenders[0]?.amount || 1);
                  return (
                    <View key={p.userId} style={{ marginTop: 12 }}>
                      <View style={styles.barRow}>
                        <Text style={styles.barName}>{p.name}</Text>
                        <Text style={[styles.barAmount, { color }]}>{C}{Math.round(p.amount).toLocaleString()}</Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Spending Trend */}
            <View style={[styles.card, { backgroundColor: SURFACE }]}>
              <Text style={styles.cardTitle}>Spending Trend</Text>
              <Text style={styles.cardSub}>
                {period === 'week' ? 'Over the past week' : period === 'month' ? 'Over the past month' : period === 'quarter' ? 'Past quarter' : 'Past year'}
              </Text>
              <View style={{ marginTop: 8, alignItems: 'center' }}>
                <LineChart values={trendSeries.values} width={SCREEN_WIDTH - 32 - 16} color={BRAND} />
                <View style={styles.weeksRow}>
                  {trendSeries.labels.map((lab, idx) => (
                    <Text key={`${lab}-${idx}`} style={styles.weekLabel}>
                      {lab}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>
        )}

        {/* Group picker half-sheet */}
        <Modal transparent visible={groupPickerOpen} animationType="fade">
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setGroupPickerOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select group</Text>
              <TouchableOpacity onPress={() => setGroupPickerOpen(false)} style={styles.sheetClose}>
                <Icon name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>
            {(!groups || groups.length === 0) ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: '#6B7280' }}>No groups found</Text>
              </View>
            ) : (
              <FlatList
                data={groups}
                keyExtractor={(g) => g.id}
                renderItem={({ item }) => {
                  const isSelected = item.id === selectedGroupId;
                  const total = groupTotals[item.id] ?? 0;
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedGroupId(item.id);
                        setGroupPickerOpen(false);
                      }}
                      style={styles.groupRow}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.groupIcon, { backgroundColor: BRAND }]}>
                        <View style={styles.groupIconPlusV} />
                        <View style={styles.groupIconPlusH} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.groupRowName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.groupRowSub} numberOfLines={1}>{C}{(total || 0).toLocaleString()}</Text>
                      </View>
                      {isSelected ? (
                        <Icon name="checkmark" size={20} color={BRAND} />
                      ) : (
                        <Icon name="chevron-forward" size={20} color="#9CA3AF" />
                      )}
                    </TouchableOpacity>
                  );
                }}
                ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />}
              />
            )}
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Bright maroon header (no app name/logo)
  heroHeader: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    paddingTop: Platform.OS === 'ios' ? 8 : 4,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    top: '50%',
    marginTop: -20,
    padding: 8,
    zIndex: 10,
  },
  headerCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  centerTitleText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 19,
    maxWidth: SCREEN_WIDTH - 140,
  },

  kpiRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 12 },
  kpiCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEE8EA',
  },
  kpiLabel: { fontSize: 12, color: '#6B7280' },
  kpiValue: { fontSize: 22, fontWeight: '800', marginTop: 6 },

  segmentContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE8EA',
    padding: 4,
    flexDirection: 'row',
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  segmentText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },

  card: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDE9EA',
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  cardSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  donutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  legendCol: { flex: 1, paddingLeft: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  legendIcon: { fontSize: 16, marginRight: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { fontSize: 12, color: '#111827', flex: 1 },
  legendPct: { fontSize: 12, fontWeight: '700', marginLeft: 4 },

  barRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barName: { fontSize: 13, color: '#111827' },
  barAmount: { fontSize: 12, fontWeight: '800' },
  barTrack: { height: 18, borderRadius: 8, backgroundColor: '#F3F4F6', marginTop: 6 },
  barFill: { height: 18, borderRadius: 8 },

  weeksRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 4, marginTop: 6 },
  weekLabel: { fontSize: 10, color: '#6B7280' },

  settleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  avatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarImg: { width: 32, height: 32, borderRadius: 16, marginRight: 12 },
  avatarText: { color: '#FFF', fontWeight: '800' },
  settleName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  settleNote: { fontSize: 12, color: '#6B7280' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' },

  sheetBackdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.2)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '52%',
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
  },
  sheetHeader: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  sheetClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  groupRow: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  groupIconPlusV: { position: 'absolute', width: 2, height: 14, backgroundColor: '#FFF' },
  groupIconPlusH: { position: 'absolute', width: 14, height: 2, backgroundColor: '#FFF' },
  groupRowName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  groupRowSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});