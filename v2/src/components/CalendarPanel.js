import { reactive, ref, computed } from 'vue';
import {
  WD, keyOfDate, parseKey, datesMatching, fmtShort, fmtLong, monthTitle,
} from '../../../src/lib/dates.js';
import {
  today, todayKey, mine, meetPeople, myMember, freeByDate, goldDates, topDates, isOpen, toggleDate, setDates, toggleVote, say,
} from '../store.js';
import { colorOf, chipStyle } from '../lib/palette.js';

const CROWN = 'M3 18h18l-1.6-10-4.9 4.2L12 5l-2.5 7.2L4.6 8z';

export default {
  name: 'CalendarPanel',
  setup() {
    const view = reactive({ y: today.getFullYear(), m: today.getMonth() });
    const selected = ref('');
    const shine = ref('');

    const canPrev = computed(() => view.y > today.getFullYear() || (view.y === today.getFullYear() && view.m > today.getMonth()));
    function shift(n) {
      let m = view.m + n; let y = view.y;
      if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
      view.m = m; view.y = y;
    }

    const myPid = computed(() => myMember.value && myMember.value.pid);
    const total = computed(() => meetPeople.value.length);

    const cells = computed(() => {
      const first = new Date(view.y, view.m, 1);
      const days = new Date(view.y, view.m + 1, 0).getDate();
      const out = [];
      for (let i = 0; i < first.getDay(); i++) out.push({ key: 'b' + i, blank: true });
      for (let d = 1; d <= days; d++) {
        const k = keyOfDate(new Date(view.y, view.m, d));
        const free = freeByDate.value[k] || [];
        const freePids = new Set(free.map((p) => p.pid));
        const past = k < todayKey;
        const gold = !past && total.value > 1 && free.length === total.value;
        const near = !past && total.value > 2 && free.length === total.value - 1;
        const stickers = meetPeople.value
          .filter((p) => freePids.has(p.pid) || near)
          .map((p) => ({
            pid: p.pid,
            cls: { me: p.pid === myPid.value, missing: near && !freePids.has(p.pid) },
            style: freePids.has(p.pid) ? { background: colorOf(p.color).hex, opacity: p.waiting ? 0.5 : 1 } : {},
          }));
        out.push({
          key: k, d, k, past, gold, near, stickers,
          cls: {
            past, gold, near, some: free.length > 0, mine: mine.dates.includes(k), today: k === todayKey,
            sel: selected.value === k, ticket: false, 'ticket-sm': gold, shine: shine.value === k,
          },
          label: fmtLong(k) + ', ว่าง ' + free.length + ' จาก ' + total.value + ' คน' + (gold ? ', ว่างครบแก๊ง' : '') + (mine.dates.includes(k) ? ', คุณว่าง' : ''),
        });
      }
      return out;
    });

    function tap(c) {
      if (c.blank || c.past) return;
      selected.value = c.k;
      if (!isOpen.value) return;
      const wasGold = goldDates.value.includes(c.k);
      toggleDate(c.k);
      if (!wasGold && goldDates.value.includes(c.k)) {
        shine.value = c.k;
        setTimeout(() => { shine.value = ''; }, 1700);
        say('ครบแก๊งแล้ว คุณคือคนสุดท้าย');
      }
    }

    // ----- quick fill -----
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const quick = reactive({ open: false, days: [6], from: todayKey, to: keyOfDate(end) });
    const toggleQ = (i) => { const k = quick.days.indexOf(i); if (k >= 0) quick.days.splice(k, 1); else quick.days.push(i); };
    const quickDates = computed(() => datesMatching(quick.from, quick.to, quick.days, today));
    const quickSummary = computed(() => {
      if (!quick.days.length) return 'เลือกวันในสัปดาห์อย่างน้อย 1 วัน';
      const q = quickDates.value;
      if (!q.length) return 'ไม่มีวันที่ตรงกับช่วงนี้';
      return 'ตรงกับ ' + q.length + ' วัน (' + fmtShort(q[0]) + (q.length > 1 ? ' – ' + fmtShort(q[q.length - 1]) : '') + ')';
    });
    function preset(kind) {
      const s = new Date(view.y, view.m, 1);
      const from = keyOfDate(s < today ? today : s);
      const until = (months) => keyOfDate(new Date(view.y, view.m + months, 0));
      if (kind === 'weekend') { quick.days = [0, 6]; quick.from = from; quick.to = until(1); }
      if (kind === 'fri') { quick.days = [5]; quick.from = from; quick.to = until(1); }
      if (kind === 'all3') { quick.days = [0, 1, 2, 3, 4, 5, 6]; quick.from = from; quick.to = until(3); }
    }
    function apply(add) {
      const n = setDates(quickDates.value, add);
      say(add ? 'ลงว่างเพิ่ม ' + n + ' วัน' : 'เอาออก ' + n + ' วัน');
      if (n && quickDates.value.length) { const d = parseKey(quickDates.value[0]); view.y = d.getFullYear(); view.m = d.getMonth(); }
    }

    const selFree = computed(() => freeByDate.value[selected.value] || []);
    const selBusy = computed(() => { const f = new Set(selFree.value.map((p) => p.pid)); return meetPeople.value.filter((p) => !f.has(p.pid)); });

    function jumpTo(k) { const d = parseKey(k); view.y = d.getFullYear(); view.m = d.getMonth(); selected.value = k; }

    return {
      WD, CROWN, view, canPrev, shift, monthTitle, cells, tap, selected, quick, toggleQ, quickDates, quickSummary, preset, apply,
      selFree, selBusy, fmtLong, fmtShort, goldDates, topDates, total, mine, toggleVote, isOpen, chipStyle, myPid, jumpTo,
    };
  },
  template: /* html */ `
  <section class="stack" style="gap: 12px">
    <button v-if="goldDates.length" type="button" class="gold-card ticket" style="cursor: pointer; text-align: left" @click="jumpTo(goldDates[0])">
      <svg class="crown" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path :d="CROWN"></path></svg>
      <span class="grow">
        <b>ว่างครบแก๊ง {{ goldDates.length }} วัน</b><br>
        <span class="small gold-ink">{{ goldDates.map(fmtShort).join(', ') }} ทุกคนว่าง ({{ total }} คน)</span>
      </span>
    </button>

    <div class="sheet" style="padding: 12px 10px">
      <div class="cal-head">
        <button class="icon-btn" @click="shift(-1)" :disabled="!canPrev" aria-label="เดือนก่อน">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>
        </button>
        <h2 class="display" style="font-weight: 600">{{ monthTitle(view.y, view.m) }}</h2>
        <button class="icon-btn" @click="shift(1)" aria-label="เดือนถัดไป">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>
        </button>
      </div>
      <div class="cal">
        <span v-for="(w, i) in WD" :key="'w' + i" class="wd">{{ w }}</span>
        <template v-for="c in cells" :key="c.key">
          <span v-if="c.blank" class="day blank" aria-hidden="true"></span>
          <button v-else type="button" class="day" :class="c.cls" :disabled="c.past" :aria-label="c.label" :aria-pressed="mine.dates.includes(c.k)" @click="tap(c)">
            <span class="n"><span>{{ c.d }}</span>
              <svg v-if="c.gold" class="crown" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path :d="CROWN"></path></svg>
            </span>
            <span class="quilt"><span v-for="s in c.stickers" :key="s.pid" class="sq" :class="s.cls" :style="s.style"></span></span>
          </button>
        </template>
      </div>
      <p class="small muted" style="margin: 4px 4px 0" v-if="isOpen">แตะวันเพื่อลงหรือเอาวันที่คุณว่างออก สติกเกอร์ที่มีกรอบคือของคุณ</p>
    </div>

    <div class="sheet" v-if="selected">
      <div class="row between">
        <h2 class="display">{{ fmtLong(selected) }}</h2>
        <span class="small muted">ว่าง {{ selFree.length }} จาก {{ total }}</span>
      </div>
      <div class="row" v-if="selFree.length">
        <span v-for="p in selFree" :key="p.pid" class="person"><span class="chip" :class="{ me: p.pid === myPid }" :style="chipStyle(p.color)">{{ p.name.charAt(0) }}</span>{{ p.name }}</span>
      </div>
      <div class="row" v-if="selBusy.length">
        <span v-for="p in selBusy" :key="p.pid" class="person off">{{ p.name }}</span>
      </div>
      <button v-if="isOpen" class="vote" :aria-pressed="mine.voteDates.includes(selected)" @click="toggleVote('voteDates', selected)" style="align-self: flex-start">
        {{ mine.voteDates.includes(selected) ? 'โหวตวันนี้แล้ว' : 'โหวตวันนี้' }}
      </button>
    </div>

    <div class="sheet" v-if="isOpen">
      <button class="row between" type="button" style="background: none; border: 0; padding: 0; cursor: pointer; width: 100%" :aria-expanded="quick.open" @click="quick.open = !quick.open">
        <h2>ลงทีละหลายวัน</h2>
        <span class="small muted">{{ quick.open ? 'ซ่อน' : 'เปิด' }}</span>
      </button>
      <template v-if="quick.open">
        <div class="row">
          <button class="btn sm" @click="preset('weekend')">เสาร์-อาทิตย์ เดือนนี้</button>
          <button class="btn sm" @click="preset('fri')">ศุกร์ทั้งเดือน</button>
          <button class="btn sm" @click="preset('all3')">ทุกวัน 3 เดือน</button>
        </div>
        <div class="seg" role="group" aria-label="วันในสัปดาห์">
          <button v-for="(w, i) in WD" :key="'q' + i" type="button" :aria-selected="quick.days.includes(i)" @click="toggleQ(i)">{{ w }}</button>
        </div>
        <div class="row">
          <div class="field grow"><label for="qf">ตั้งแต่</label><input id="qf" class="input" type="date" v-model="quick.from"></div>
          <div class="field grow"><label for="qt">ถึง</label><input id="qt" class="input" type="date" v-model="quick.to"></div>
        </div>
        <p class="small muted" style="margin: 0">{{ quickSummary }}</p>
        <div class="row">
          <button class="btn primary" @click="apply(true)" :disabled="!quickDates.length">ลงว่าง</button>
          <button class="btn" @click="apply(false)" :disabled="!quickDates.length">เอาออก</button>
        </div>
      </template>
    </div>

    <div class="sheet">
      <h2>วันที่น่าไปที่สุด</h2>
      <div class="list" v-if="topDates.length">
        <div v-for="(r, i) in topDates.slice(0, 6)" :key="r.date" class="item" :class="{ lead: i === 0 && r.votes.length }" style="flex-wrap: wrap">
          <button type="button" class="grow" style="background: none; border: 0; padding: 0; text-align: left; cursor: pointer" @click="jumpTo(r.date)">
            <b>{{ fmtLong(r.date) }}</b>
            <svg v-if="goldDates.includes(r.date)" class="crown" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-label="ว่างครบ"><path :d="CROWN"></path></svg>
            <span class="chips" style="margin-top: 4px"><span v-for="p in r.free" :key="p.pid" class="sq" :style="{ background: chipStyle(p.color).background }"></span></span>
            <span class="small muted">ว่าง {{ r.free.length }}/{{ total }}<template v-if="r.votes.length">, โหวต {{ r.votes.length }}</template></span>
          </button>
          <button v-if="isOpen" class="vote" :aria-pressed="mine.voteDates.includes(r.date)" @click="toggleVote('voteDates', r.date)">{{ mine.voteDates.includes(r.date) ? 'โหวตแล้ว' : 'โหวต' }}</button>
        </div>
      </div>
      <p class="muted small" v-else>ยังไม่มีใครลงวันว่าง เริ่มจากแตะวันที่คุณว่างบนปฏิทิน</p>
    </div>
  </section>`,
};
