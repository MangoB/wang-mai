import { ref, computed } from 'vue';
import { meetup, topDates, placesRanked, goldDates, meetPeople, decideDate, decidePlace, say, explain, todayKey } from '../store.js';
import { fmtLong } from '../lib/dates.js';

// สรุปวัน / สรุปสถานที่: pick any option, not only the most voted one. '' undoes the decision.
export default {
  name: 'DecideSheet',
  props: { kind: { type: String, required: true }, preset: { type: String, default: '' } }, // 'date' | 'place'
  emits: ['close'],
  setup(props, { emit }) {
    const result = computed(() => (meetup.data && meetup.data.result) || {});
    const current = computed(() => (props.kind === 'date' ? result.value.date : result.value.placeId) || '');
    const choice = ref(props.preset || current.value);
    const other = ref('');
    const busy = ref(false);
    const n = computed(() => meetPeople.value.length);

    const options = computed(() => {
      if (props.kind === 'place') {
        return placesRanked.value.map((p) => ({ value: p.id, label: p.title, sub: 'โหวต ' + p.votes.length + (p.gold ? ' · ทุกคนโหวต' : ''), gold: p.gold }));
      }
      const list = topDates.value.map((r) => ({
        value: r.date, label: fmtLong(r.date), sub: 'ว่าง ' + r.free.length + '/' + n.value + (r.votes.length ? ' · โหวต ' + r.votes.length : ''), gold: goldDates.value.includes(r.date),
      }));
      for (const v of [current.value, props.preset]) {
        if (v && !list.some((o) => o.value === v)) list.unshift({ value: v, label: fmtLong(v), sub: '', gold: false });
      }
      return list;
    });

    async function save(value) {
      busy.value = true;
      try {
        if (props.kind === 'date') await decideDate(value); else await decidePlace(value);
        say(value ? (props.kind === 'date' ? 'สรุปวันแล้ว' : 'สรุปสถานที่แล้ว') : 'ยกเลิกการสรุปแล้ว');
        emit('close');
      } catch (e) { say(explain(e), 'error'); }
      busy.value = false;
    }
    function pickOther() { if (other.value) choice.value = other.value; }

    return { result, current, choice, other, busy, options, save, pickOther, todayKey };
  },
  template: /* html */ `
  <div class="backdrop" @click.self="$emit('close')">
    <form class="modal" role="dialog" aria-modal="true" aria-labelledby="decide-title" @submit.prevent="save(choice)">
      <h2 id="decide-title" class="display" style="font-size: 24px">{{ kind === 'date' ? 'สรุปวัน' : 'สรุปสถานที่' }}</h2>
      <p class="muted small" style="margin: -8px 0 0">เลือกอันไหนก็ได้ ไม่จำเป็นต้องเป็นอันที่โหวตเยอะสุด เปลี่ยนทีหลังได้จนกว่าจะปิดนัด</p>
      <p v-if="!options.length" class="muted" style="margin: 0">{{ kind === 'date' ? 'ยังไม่มีใครลงวันว่าง เลือกวันเองด้านล่างได้' : 'ยังไม่มีใครเสนอสถานที่ เสนอในแท็บสถานที่ก่อน' }}</p>
      <div class="stack" role="radiogroup" :aria-label="kind === 'date' ? 'วัน' : 'สถานที่'">
        <label v-for="o in options" :key="o.value" class="item" :class="{ lead: choice === o.value }" style="cursor: pointer">
          <input type="radio" :value="o.value" v-model="choice" style="width: 18px; height: 18px; accent-color: var(--ink)">
          <span class="grow"><b>{{ o.label }}</b><br><span class="small muted">{{ o.sub }}</span></span>
          <span v-if="o.gold" class="tag" style="background: var(--gold-soft); color: var(--gold-ink)">👑</span>
        </label>
      </div>
      <div v-if="kind === 'date'" class="row">
        <label for="decide-other" class="small muted">วันอื่น</label>
        <input id="decide-other" class="input grow" type="date" :min="todayKey" v-model="other" @change="pickOther">
      </div>
      <div class="row" style="justify-content: flex-end">
        <button v-if="current" type="button" class="btn ghost" :disabled="busy" @click="save('')">ยังไม่สรุป</button>
        <button type="button" class="btn" @click="$emit('close')">ยกเลิก</button>
        <button type="submit" class="btn primary" :disabled="busy || !choice">{{ kind === 'date' ? 'สรุปวันนี้' : 'สรุปสถานที่นี้' }}</button>
      </div>
    </form>
  </div>`,
};
