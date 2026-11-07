import { reactive, computed, watch } from 'vue';
import {
  room, meetup, canRun, notYet, people, createInvite, meetupLink, guestLink, say, explain,
} from '../store.js';
import { COLORS, chipStyle, freeColor } from '../lib/palette.js';
import { shareText, copyText } from '../lib/share.js';

// "ส่งให้เพื่อน": the message that asks the gang, who has not answered yet, and guests for this meetup only.
export default {
  name: 'SendSheet',
  emits: ['close'],
  setup() {
    const message = computed(() => 'ว่างไหม? 📅 ' + (meetup.data ? meetup.data.title : '')
      + '\nลงวันว่างกับเสนอสถานที่กันหน่อย\n' + meetupLink(meetup.id));

    async function send() {
      const r = await shareText(message.value);
      if (r === 'copied') say('คัดลอกข้อความแล้ว ไปวางในแชทได้เลย');
      else if (!r && !navigator.share) say('คัดลอกไม่ได้ กดค้างที่ข้อความเพื่อคัดลอกเอง', 'error');
    }
    async function copy() {
      if (await copyText(message.value)) say('คัดลอกข้อความแล้ว'); else say('คัดลอกไม่ได้ กดค้างที่ข้อความเพื่อคัดลอกเอง', 'error');
    }

    // ----- a guest of this meetup -----
    const g = reactive({ name: '', color: 0, busy: false, code: '', who: '' });
    watch(() => people.value.length, () => { g.color = freeColor(people.value.map((p) => p.color)); }, { immediate: true });
    async function invite() {
      const n = g.name.replace(/\s+/g, ' ').trim();
      if (!n) return;
      g.busy = true;
      try {
        g.code = await createInvite(n.slice(0, 30), g.color, meetup.id);
        g.who = n;
        g.name = '';
        g.color = freeColor([...people.value.map((p) => p.color), g.color]);
      } catch (e) { say(explain(e), 'error'); }
      g.busy = false;
    }
    const guestMessage = computed(() => g.code
      ? 'ว่างไหม? 📅 ' + meetup.data.title + '\nลิงก์ของ ' + g.who + ' (ของคุณคนเดียว อย่าส่งต่อนะ)\n' + guestLink(g.code)
      : '');
    async function sendGuest() {
      const r = await shareText(guestMessage.value);
      if (r === 'copied') say('คัดลอกลิงก์ของ ' + g.who + ' แล้ว');
    }

    return { room, meetup, canRun, notYet, message, send, copy, g, invite, sendGuest, COLORS, chipStyle };
  },
  template: /* html */ `
  <div class="backdrop" @click.self="$emit('close')">
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="send-title">
      <div class="row between">
        <h2 id="send-title" class="display" style="font-size: 24px">ส่งให้เพื่อน</h2>
        <button class="btn sm ghost" type="button" @click="$emit('close')">ปิด</button>
      </div>

      <div class="stack" style="border: 1px solid var(--line); border-radius: 16px; padding: 12px">
        <b>ถามแก๊ง</b>
        <p style="margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--sunk); white-space: pre-line; overflow-wrap: anywhere; font-size: 14px">{{ message }}</p>
        <div class="row">
          <button class="btn primary grow" type="button" @click="send">ส่ง</button>
          <button class="btn" type="button" @click="copy">คัดลอก</button>
        </div>
        <div class="row small muted" v-if="notYet.length">
          ยังไม่ลงวันว่าง
          <span class="chips"><span v-for="p in notYet" :key="p.pid" class="chip" :style="chipStyle(p.color)">{{ p.name.charAt(0) }}</span></span>
          {{ notYet.map((p) => p.name).join(', ') }}
        </div>
        <p class="small muted" style="margin: 0" v-else>ทุกคนลงวันว่างแล้ว</p>
      </div>

      <form v-if="canRun" class="stack" style="border: 1px solid var(--line); border-radius: 16px; padding: 12px" @submit.prevent="invite">
        <div><b>ชวนแขกมานัดนี้</b><br><span class="small muted">คนนอกแก๊ง เห็นแค่นัดนี้ ได้ลิงก์ส่วนตัวไว้ส่งให้เขา</span></div>
        <div class="row">
          <input class="input grow" v-model="g.name" maxlength="30" placeholder="ชื่อแขก" aria-label="ชื่อแขก">
          <button class="btn" type="submit" :disabled="g.busy || !g.name.trim()">สร้างลิงก์</button>
        </div>
        <div class="swatches">
          <button v-for="(c, i) in COLORS" :key="i" type="button" class="swatch" :style="{ background: c.hex }" :aria-label="c.name" :aria-pressed="g.color === i" @click="g.color = i"></button>
        </div>
        <div v-if="g.code" class="item lead">
          <span class="grow">ลิงก์ของ <b>{{ g.who }}</b> พร้อมแล้ว</span>
          <button class="btn sm primary" type="button" @click="sendGuest">ส่งลิงก์</button>
        </div>
      </form>
    </section>
  </div>`,
};
