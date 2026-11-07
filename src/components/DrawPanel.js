import { ref, computed, watch } from 'vue';
import { fmtLong, fmtShort } from '../lib/dates.js';
import {
  meetup, topDates, goldDates, placesRanked, canRun, isOpen, draw, personByPid, say, explain,
} from '../store.js';

const CROWN = 'M3 18h18l-1.6-10-4.9 4.2L12 5l-2.5 7.2L4.6 8z';

export default {
  name: 'DrawPanel',
  emits: ['decide'],
  setup(props, { emit }) {
    const kind = ref('date');
    const picked = ref([]);

    const options = computed(() => (kind.value === 'date'
      ? topDates.value.map((r) => ({ id: r.date, label: fmtLong(r.date), sub: r.free.length + ' คนว่าง', gold: goldDates.value.includes(r.date) }))
      : placesRanked.value.map((p) => ({ id: p.id, label: p.title, sub: p.votes.length + ' โหวต', gold: p.gold }))));

    // Default selection: the gold options, otherwise the top three.
    function resetPick() {
      const gold = options.value.filter((o) => o.gold).map((o) => o.id);
      picked.value = gold.length >= 2 ? gold : options.value.slice(0, 3).map((o) => o.id);
    }
    watch(kind, resetPick);
    watch(() => options.value.length, (n, old) => { if (!old) resetPick(); }, { immediate: true });

    const toggle = (id) => { const i = picked.value.indexOf(id); if (i >= 0) picked.value.splice(i, 1); else picked.value.push(id); };
    const used = computed(() => (meetup.data && meetup.data.drawCount ? meetup.data.drawCount[kind.value] || 0 : 0));
    const left = computed(() => 3 - used.value);
    const canDraw = computed(() => canRun.value && isOpen.value && left.value > 0 && picked.value.length >= 2);
    const busy = ref(false);

    async function run() {
      busy.value = true;
      try {
        const order = options.value.map((o) => o.id).filter((id) => picked.value.includes(id));
        await draw(kind.value, order);
      } catch (e) { say(e.code ? explain(e) : e.message, 'error'); }
      busy.value = false;
    }

    const labelOf = (k, id) => {
      if (k === 'date') return fmtShort(id);
      const p = meetup.places.find((x) => x.id === id);
      return p ? p.title : 'สถานที่ที่ถูกลบไปแล้ว';
    };
    const history = computed(() => meetup.draws.filter((d) => d.kind === kind.value));
    const latest = computed(() => history.value[0] || null);
    const byName = (pid) => (personByPid.value.get(pid) || {}).name || 'ใครสักคน';
    const when = (d) => (d.at && d.at.toDate ? d.at.toDate().toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

    function useLatest() {
      if (!latest.value) return;
      emit('decide', { kind: kind.value, value: latest.value.result });
    }

    return {
      CROWN, kind, options, picked, toggle, used, left, canDraw, busy, run, history, latest, labelOf, byName, when, canRun, isOpen, useLatest, fmtLong,
    };
  },
  template: /* html */ `
  <section class="stack" style="gap: 12px">
    <div class="row between">
      <div class="seg" role="tablist" aria-label="สุ่มอะไร" style="min-width: 200px">
        <button type="button" role="tab" :aria-selected="kind === 'date'" @click="kind = 'date'">วัน</button>
        <button type="button" role="tab" :aria-selected="kind === 'place'" @click="kind = 'place'">สถานที่</button>
      </div>
      <span class="tag" :style="left === 0 ? 'background: var(--ink); color: var(--on-ink)' : ''">{{ left > 0 ? 'เหลือ ' + left + ' ครั้ง' : 'ครบ 3 ครั้งแล้ว' }}</span>
    </div>

    <div class="sheet" v-if="canRun && isOpen">
      <div class="row between"><h2>สุ่มจาก</h2><span class="small muted">เลือกไว้ {{ picked.length }}</span></div>
      <div class="list" v-if="options.length">
        <button v-for="o in options" :key="o.id" type="button" role="checkbox" :aria-checked="picked.includes(o.id)" @click="toggle(o.id)"
          class="item" :class="{ 'ticket-sm': o.gold }" :style="o.gold ? 'background: var(--gold-soft); border: 2px solid var(--gold); cursor: pointer; text-align: left' : 'cursor: pointer; text-align: left'">
          <span class="chip" :style="picked.includes(o.id) ? 'background: var(--ink); color: var(--on-ink)' : 'border: 2px solid var(--ink-2)'" aria-hidden="true">
            <svg v-if="picked.includes(o.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12l4 4 10-10"></path></svg>
          </span>
          <b class="grow">{{ o.label }}</b>
          <span class="small" :class="o.gold ? 'gold-ink' : 'muted'">{{ o.sub }}</span>
        </button>
      </div>
      <p class="small muted" v-else>{{ kind === 'date' ? 'ยังไม่มีวันว่างให้สุ่ม' : 'ยังไม่มีสถานที่ให้สุ่ม' }}</p>
      <button class="btn primary" @click="run" :disabled="!canDraw || busy">
        {{ left === 0 ? 'สุ่มครบแล้ว เลือกเองได้เลย' : (picked.length < 2 ? 'เลือกอย่างน้อย 2 ตัวเลือก' : 'สุ่มเลย') }}
      </button>
    </div>
    <p class="small muted" v-else-if="isOpen">ผู้สร้างนัดและผู้ดูแลแก๊งเป็นคนกดสุ่ม ทุกคนเห็นผลและประวัติเหมือนกัน</p>

    <div v-if="latest" class="ticket" style="background: var(--ink); color: var(--on-ink); border-radius: 16px">
      <div style="padding: 16px 26px 12px">
        <div class="small" style="color: var(--gold-bright); font-weight: 600">สุ่มได้ ครั้งที่ {{ latest.n }} จาก 3</div>
        <div class="display" style="font-size: 26px; line-height: 1.2">{{ kind === 'date' ? fmtLong(latest.result) : labelOf('place', latest.result) }}</div>
      </div>
      <div style="border-top: 2px dashed var(--on-ink-2); margin: 0 14px"></div>
      <div class="row between" style="padding: 12px 26px 16px">
        <span class="small" style="color: var(--on-ink-2)">โดย {{ byName(latest.pid) }} {{ when(latest) }}</span>
        <button v-if="canRun && isOpen" class="btn sm" style="background: transparent; color: var(--gold-bright); border-color: var(--gold-bright)" @click="useLatest">{{ kind === 'date' ? 'ใช้สรุปวัน' : 'ใช้สรุปสถานที่' }}</button>
      </div>
    </div>

    <div class="stack" v-if="history.length">
      <h2>หลักฐานการสุ่ม</h2>
      <p class="small muted" style="margin: 0">บันทึกทุกครั้ง ลบหรือแก้ไม่ได้ แม้แต่ผู้สร้างแก๊ง</p>
      <div v-for="h in history" :key="h.id" class="item" style="flex-direction: column; align-items: stretch; gap: 4px">
        <div class="row between small muted"><span>ครั้งที่ {{ h.n }} โดย {{ byName(h.pid) }}</span><span>{{ when(h) }}</span></div>
        <div style="font-size: 14px">จาก {{ h.candidates.map((c) => labelOf(h.kind, c)).join(', ') }}</div>
        <b>ได้ {{ labelOf(h.kind, h.result) }}</b>
      </div>
    </div>
  </section>`,
};
