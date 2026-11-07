import { ref, reactive, computed, watch } from 'vue';
import {
  room, meetup, openMeetup, isHost, isOpen, saveState, topDates, placesRanked, goldDates, people, meetPeople, meetRoster,
  concludeMeetup, reopenMeetup, setHidden, renameMeetup, say, explain,
} from '../store.js';
import { fmtLong, parseKey, MSHORT, WD_LONG } from '../../../src/lib/dates.js';
import { chipStyle } from '../lib/palette.js';
import CalendarPanel from '../components/CalendarPanel.js';
import PlacesPanel from '../components/PlacesPanel.js';
import DrawPanel from '../components/DrawPanel.js';
import EditableTitle from '../components/EditableTitle.js';

export default {
  name: 'MeetupView',
  components: { CalendarPanel, PlacesPanel, DrawPanel, EditableTitle },
  props: { roomId: String, meetId: String },
  setup(props) {
    watch(() => [props.roomId, props.meetId], ([r, m]) => openMeetup(r, m), { immediate: true });
    const tab = ref('dates');

    // ----- conclude -----
    const sheet = reactive({ open: false, date: '', placeId: '', via: 'vote', busy: false });
    function openConclude(pre = {}) {
      sheet.date = pre.date || (goldDates.value[0] || (topDates.value[0] && topDates.value[0].date) || '');
      sheet.placeId = pre.placeId || (placesRanked.value[0] && placesRanked.value[0].id) || '';
      sheet.via = pre.via || 'vote';
      sheet.open = true;
    }
    async function confirmConclude() {
      sheet.busy = true;
      try { await concludeMeetup({ date: sheet.date, placeId: sheet.placeId, via: sheet.via }); sheet.open = false; say('สรุปนัดแล้ว'); }
      catch (e) { say(explain(e), 'error'); }
      sheet.busy = false;
    }
    async function reopen() {
      try { await reopenMeetup(); say('เปิดนัดอีกครั้งแล้ว'); } catch (e) { say(explain(e), 'error'); }
    }

    // ----- hide people for this meetup (hosts) -----
    const hiddenPids = computed(() => new Set(meetup.avail.filter((a) => a.hidden).map((a) => a.pid)));
    const hasEntry = (pid) => meetup.avail.some((a) => a.pid === pid);
    async function toggleHidden(p) {
      try { await setHidden(p.pid, !hiddenPids.value.has(p.pid)); } catch (e) { say(explain(e), 'error'); }
    }

    const result = computed(() => meetup.data && meetup.data.result);
    const resultDay = computed(() => {
      if (!result.value || !result.value.date) return null;
      const d = parseKey(result.value.date);
      return { d: d.getDate(), m: MSHORT[d.getMonth()], w: WD_LONG[d.getDay()] };
    });
    const entered = computed(() => meetup.avail.filter((a) => a.dates).length);

    async function rename(title) {
      try { await renameMeetup(title); say('เปลี่ยนชื่อนัดแล้ว'); } catch (e) { say(explain(e), 'error'); }
    }

    return {
      rename,
      room, meetup, isHost, isOpen, saveState, tab, sheet, openConclude, confirmConclude, reopen, topDates, placesRanked, fmtLong,
      people, meetPeople, meetRoster, hiddenPids, hasEntry, toggleHidden, chipStyle, result, resultDay, entered,
    };
  },
  template: /* html */ `
  <section class="stack" style="gap: 14px">
    <a v-if="room.data" :href="'#r-' + room.id" class="small muted row" style="text-decoration: none; gap: 4px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>
      {{ room.data.name }}
    </a>
    <p v-if="meetup.loaded && !meetup.data" class="sheet">ไม่พบนัดนี้ <a :href="'#r-' + roomId">กลับไปที่ห้อง</a></p>

    <template v-if="meetup.data">
      <header class="row between" style="align-items: flex-end">
        <div class="grow">
          <EditableTitle :value="meetup.data.title" :can-edit="isHost" :max="60" label="ชื่อนัด" @save="rename" />
          <p class="muted small" style="margin: 4px 0 0">
            <template v-if="isOpen">ลงว่างแล้ว {{ entered }} จาก {{ meetPeople.length }} คน</template>
            <template v-else>สรุปนัดแล้ว</template>
            <span v-if="saveState"> ({{ saveState }})</span>
          </p>
        </div>
        <button v-if="isHost && isOpen" class="btn primary" @click="openConclude()">สรุปนัด</button>
        <button v-if="isHost && !isOpen" class="btn sm" @click="reopen">เปิดนัดอีกครั้ง</button>
      </header>

      <!-- concluded: gold ticket -->
      <div v-if="!isOpen && result" class="ticket" style="display: grid; grid-template-columns: 84px minmax(0, 1fr); background: var(--gold-soft); border: 2px solid var(--gold); border-radius: 16px; overflow: hidden">
        <span v-if="resultDay" style="background: var(--gold); color: var(--ink-fixed); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 14px 0 14px 10px">
          <span class="small" style="font-weight: 600">{{ resultDay.m }}</span>
          <span class="display" style="font-size: 32px; line-height: 1">{{ resultDay.d }}</span>
          <span class="small">{{ resultDay.w }}</span>
        </span>
        <span v-else></span>
        <span style="padding: 12px 22px 12px 14px; border-left: 2px dashed var(--gold); display: flex; flex-direction: column; gap: 4px">
          <span class="small gold-ink" style="font-weight: 600">{{ result.via === 'draw' ? 'ได้จากการสุ่ม' : 'สรุปจากโหวต' }}</span>
          <span style="font-weight: 600; font-size: 18px">{{ result.placeTitle || 'ยังไม่ได้เลือกที่' }}</span>
          <a v-if="result.placeUrl" :href="result.placeUrl" target="_blank" rel="noopener noreferrer" class="small" style="font-weight: 600">เปิดแผนที่</a>
        </span>
      </div>

      <div class="tabs">
        <div class="seg" role="tablist" aria-label="ส่วนของนัด">
          <button type="button" role="tab" :aria-selected="tab === 'dates'" @click="tab = 'dates'">วันว่าง</button>
          <button type="button" role="tab" :aria-selected="tab === 'places'" @click="tab = 'places'">ที่นัด</button>
          <button type="button" role="tab" :aria-selected="tab === 'draw'" @click="tab = 'draw'">สุ่ม</button>
        </div>
      </div>

      <div class="meet-grid">
        <div>
          <CalendarPanel v-if="tab === 'dates'" />
          <PlacesPanel v-else-if="tab === 'places'" />
          <DrawPanel v-else @conclude="openConclude" />
        </div>
        <aside class="sheet">
          <h2>ใครอยู่ในนัดนี้</h2>
          <ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px">
            <li v-for="p in meetRoster" :key="p.pid" class="row between">
              <span class="row" :style="hiddenPids.has(p.pid) ? 'opacity: .45' : ''">
                <span class="chip" :style="chipStyle(p.color)">{{ p.name.charAt(0) }}</span>
                <span :style="hiddenPids.has(p.pid) ? 'text-decoration: line-through' : ''">{{ p.name }}</span>
                <span v-if="p.meetId" class="tag">แขก</span>
              </span>
              <button v-if="isHost && isOpen && hasEntry(p.pid)" class="btn sm ghost" @click="toggleHidden(p)">
                {{ hiddenPids.has(p.pid) ? 'นับรวม' : 'ไม่นับนัดนี้' }}
              </button>
            </li>
          </ul>
          <p class="small muted" style="margin: 0" v-if="isHost">"ไม่นับนัดนี้" ใช้กับคนที่บอกว่ารอบนี้ไม่ไป จะไม่ถูกนับตอนหาวันที่ว่างครบ</p>
        </aside>
      </div>
    </template>

    <div class="backdrop" v-if="sheet.open" @click.self="sheet.open = false">
      <form class="modal" role="dialog" aria-modal="true" aria-labelledby="ctitle" @submit.prevent="confirmConclude">
        <h2 id="ctitle" class="display" style="font-size: 22px">สรุปนัด</h2>
        <div class="field">
          <label for="cdate">วัน</label>
          <select id="cdate" class="input" v-model="sheet.date">
            <option value="">ยังไม่เลือกวัน</option>
            <option v-for="r in topDates" :key="r.date" :value="r.date">{{ fmtLong(r.date) }} (ว่าง {{ r.free.length }})</option>
            <option v-if="sheet.date && !topDates.some((r) => r.date === sheet.date)" :value="sheet.date">{{ fmtLong(sheet.date) }}</option>
          </select>
        </div>
        <div class="field">
          <label for="cplace">ที่นัด</label>
          <select id="cplace" class="input" v-model="sheet.placeId">
            <option value="">ยังไม่เลือกที่</option>
            <option v-for="p in placesRanked" :key="p.id" :value="p.id">{{ p.title }} ({{ p.votes.length }} โหวต)</option>
          </select>
        </div>
        <p class="small muted" style="margin: 0">สรุปแล้วทุกคนจะแก้วันว่างและโหวตไม่ได้ เปิดนัดอีกครั้งได้ภายหลัง</p>
        <div class="row" style="justify-content: flex-end">
          <button type="button" class="btn" @click="sheet.open = false">ยกเลิก</button>
          <button type="submit" class="btn primary" :disabled="sheet.busy || (!sheet.date && !sheet.placeId)">สรุปนัด</button>
        </div>
      </form>
    </div>
  </section>`,
};
