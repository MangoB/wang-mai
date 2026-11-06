import { fmtShort, fmtWeekday } from '../lib/dates.js';
import { me, activePeople, topDates, toggleVote } from '../store.js';

export default {
  name: 'DateVotes',
  setup() {
    const pct = (n) => (n / Math.max(1, activePeople.value.length)) * 100 + '%';
    return { me, activePeople, topDates, toggleVote, fmtShort, fmtWeekday, pct };
  },
  template: `
  <section class="board">
    <h2>โหวตวัน</h2>
    <p class="sub">วันที่มีคนว่างมากที่สุด เลือกโหวตได้หลายวัน</p>
    <div class="dlist" v-if="topDates.length">
      <div class="drow" v-for="(r,i) in topDates" :key="r.date" :class="{lead: i===0 && r.votes.length}">
        <div class="ddate">{{ fmtShort(r.date) }}<small>{{ fmtWeekday(r.date) }}</small></div>
        <div class="mid">
          <div>
            <b>ว่าง {{ r.names.length }}/{{ activePeople.length }}</b>
            <span class="pill" v-if="r.names.length === activePeople.length && activePeople.length > 1">ว่างครบ</span>
          </div>
          <div class="bar"><span :style="{width: pct(r.names.length)}"></span></div>
          <div class="names">{{ r.names.join(', ') }}<template v-if="r.votes.length"> · โหวต: {{ r.votes.join(', ') }}</template></div>
        </div>
        <button class="vote" :class="{on: me.voteDates.includes(r.date)}" :aria-pressed="me.voteDates.includes(r.date)"
          @click="toggleVote('voteDates', r.date)">
          {{ me.voteDates.includes(r.date) ? 'โหวตแล้ว' : 'โหวต' }} <span class="k">{{ r.votes.length }}</span>
        </button>
      </div>
    </div>
    <div class="empty" v-else>ยังไม่มีวันว่าง ลงวันในปฏิทินด้านบน แล้ววันที่ว่างตรงกันจะขึ้นที่นี่</div>
  </section>`,
};
