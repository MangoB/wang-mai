import { reactive, ref, computed } from 'vue';
import {
  WD, keyOfDate, parseKey, datesMatching, fmtShort, fmtLong, monthTitle,
} from '../lib/dates.js';
import {
  today, todayKey, me, activePeople, availMap, toggleDate, setDates, clearMyDates, say,
} from '../store.js';

export default {
  name: 'CalendarBoard',
  setup() {
    const view = reactive({ y: today.getFullYear(), m: today.getMonth() });
    const selected = ref('');

    const title = computed(() => monthTitle(view.y, view.m));
    const canPrev = computed(() => view.y > today.getFullYear() || (view.y === today.getFullYear() && view.m > today.getMonth()));
    function shiftMonth(n) {
      let m = view.m + n; let y = view.y;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      view.m = m; view.y = y;
    }

    const cells = computed(() => {
      const first = new Date(view.y, view.m, 1);
      const n = new Date(view.y, view.m + 1, 0).getDate();
      const out = [];
      for (let i = 0; i < first.getDay(); i++) out.push({ key: 'b' + i });
      for (let d = 1; d <= n; d++) {
        const dt = new Date(view.y, view.m, d);
        const k = keyOfDate(dt);
        out.push({ key: k, date: k, d, past: dt < today, today: k === todayKey, count: (availMap.value[k] || []).length });
      }
      return out;
    });

    function dayClass(c) {
      const total = activePeople.value.length;
      let h = '';
      if (c.count) {
        if (total <= 1) h = 'h2';
        else {
          const r = c.count / total;
          h = r >= 1 ? 'h4' : r >= 0.66 ? 'h3' : r >= 0.34 ? 'h2' : 'h1';
        }
      }
      return [h, { mine: me.dates.includes(c.date), past: c.past, sel: selected.value === c.date, today: c.today }];
    }

    function tap(c) {
      selected.value = c.date;
      if (!c.past) toggleDate(c.date);
    }

    // quick fill
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const quick = reactive({ days: [6], from: todayKey, to: keyOfDate(endOfMonth) });
    const toggleQDay = (i) => {
      const k = quick.days.indexOf(i);
      if (k >= 0) quick.days.splice(k, 1); else quick.days.push(i);
    };
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
      const end = (months) => keyOfDate(new Date(view.y, view.m + months, 0));
      if (kind === 'weekend') { quick.days.splice(0, 9, 0, 6); quick.from = from; quick.to = end(1); }
      if (kind === 'fri') { quick.days.splice(0, 9, 5); quick.from = from; quick.to = end(1); }
      if (kind === 'every3') { quick.days.splice(0, 9, 0, 1, 2, 3, 4, 5, 6); quick.from = from; quick.to = end(3); }
    }
    function apply(add) {
      const changed = setDates(quickDates.value, add);
      if (changed || add === false) say(add ? 'ลงว่างเพิ่ม ' + changed + ' วัน' : 'เอาออก ' + changed + ' วัน');
      // jump the calendar to the first date affected so the change is visible
      if (changed && quickDates.value.length) {
        const d = parseKey(quickDates.value[0]);
        view.y = d.getFullYear(); view.m = d.getMonth();
      }
    }

    return {
      WD, todayKey, me, availMap, title, canPrev, shiftMonth, cells, dayClass, tap, selected, fmtLong,
      quick, toggleQDay, quickDates, quickSummary, preset, apply, clearMyDates,
    };
  },
  template: `
  <section class="board">
    <h2>วันว่าง</h2>
    <p class="sub">แตะวันที่เพื่อเพิ่มหรือเอาออก สีเข้มขึ้นแปลว่าว่างกันหลายคน กรอบสีเหลืองคือวันที่คุณลงไว้</p>
    <div class="cal-layout">
      <div>
        <div class="cal-head">
          <button class="btn sm" @click="shiftMonth(-1)" :disabled="!canPrev" aria-label="เดือนก่อน">‹</button>
          <h3>{{ title }}</h3>
          <button class="btn sm" @click="shiftMonth(1)" aria-label="เดือนถัดไป">›</button>
        </div>
        <div class="cal">
          <div class="wd" v-for="(w,i) in WD" :key="'w'+i" :class="{we: i===0 || i===6}">{{ w }}</div>
          <template v-for="c in cells" :key="c.key">
            <div v-if="!c.date" class="day blank"></div>
            <button v-else class="day" :class="dayClass(c)" :disabled="c.past" @click="tap(c)"
              :aria-label="fmtLong(c.date) + (c.count ? ' ว่าง ' + c.count + ' คน' : '')" :aria-pressed="me.dates.includes(c.date)">
              <span class="n">{{ c.d }}</span>
              <span class="c" v-if="c.count">{{ c.count }}</span>
            </button>
          </template>
        </div>
        <div class="legend">
          <span><i class="lg-mine"></i>คุณว่าง</span>
          <span class="scale"><i class="day h1"></i><i class="day h2"></i><i class="day h3"></i><i class="day h4"></i></span>
          <span>ว่าง 1 คน → ว่างครบทุกคน</span>
        </div>
        <div class="daydetail" v-if="selected">
          <strong>{{ fmtLong(selected) }}</strong>
          <div class="names" v-if="(availMap[selected] || []).length">ว่าง: {{ availMap[selected].join(', ') }}</div>
          <div class="names" v-else>ยังไม่มีใครลงวันนี้</div>
        </div>
      </div>

      <aside class="quick">
        <h3>ลงทีละหลายวัน</h3>
        <div>
          <div class="label mb">วันในสัปดาห์</div>
          <div class="wdpick">
            <button v-for="(w,i) in WD" :key="'q'+i" type="button" :class="{on: quick.days.includes(i)}"
              :aria-pressed="quick.days.includes(i)" @click="toggleQDay(i)">{{ w }}</button>
          </div>
        </div>
        <div class="two">
          <div class="field"><label class="label" for="qfrom">ตั้งแต่</label><input id="qfrom" type="date" v-model="quick.from" :min="todayKey"></div>
          <div class="field"><label class="label" for="qto">ถึง</label><input id="qto" type="date" v-model="quick.to" :min="quick.from || todayKey"></div>
        </div>
        <div class="presets">
          <button class="btn sm" @click="preset('weekend')">เสาร์-อาทิตย์ เดือนนี้</button>
          <button class="btn sm" @click="preset('fri')">ศุกร์ทั้งเดือน</button>
          <button class="btn sm" @click="preset('every3')">ทุกวัน 3 เดือน</button>
        </div>
        <p class="hint">{{ quickSummary }}</p>
        <div class="row">
          <button class="btn primary" @click="apply(true)" :disabled="!quickDates.length">ลงว่าง</button>
          <button class="btn" @click="apply(false)" :disabled="!quickDates.length">เอาออก</button>
        </div>
        <button class="btn ghost sm self-start" v-if="me.dates.length" @click="clearMyDates">ล้างวันที่ฉันลงทั้งหมด ({{ me.dates.length }})</button>
      </aside>
    </div>
  </section>`,
};
