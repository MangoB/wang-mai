import { ref, reactive, computed, watch } from 'vue';
import {
  room, openRoom, watchInvites, myMember, isHost, isOwner, people, session, takenColors, setMyColor,
  createInvite, deleteInvite, setRole, blockMember, unblockMember, removeMember, rotateRoomCode, leaveRoom, deleteRoom, say, explain,
} from '../store.js';
import { COLORS, chipStyle, freeColor } from '../lib/palette.js';
import { prettyCode } from '../lib/codes.js';

export default {
  name: 'MembersView',
  props: { roomId: String },
  setup(props) {
    watch(() => props.roomId, (id) => openRoom(id), { immediate: true });
    let watching = false;
    watch(isHost, (h) => { if (h && !watching) { watching = true; watchInvites(); } }, { immediate: true });

    const blocked = computed(() => room.members.filter((m) => m.status === 'blocked'));
    const openMenu = ref('');
    const confirm = reactive({ key: '', label: '' });

    async function act(key, fn, done) {
      if (confirm.key !== key) { confirm.key = key; return; }
      confirm.key = '';
      try { await fn(); if (done) say(done); } catch (e) { say(explain(e), 'error'); }
    }

    // ----- invites -----
    const inv = reactive({ name: '', color: 0, busy: false, lastCode: '' });
    // Colours already in use: everyone in the room plus invites nobody has used yet.
    const inUse = computed(() => [...people.value.map((p) => p.color), ...room.invites.filter((i) => !i.claimedBy).map((i) => i.color)]);
    watch(() => inUse.value.join(','), () => { inv.color = freeColor(inUse.value); }, { immediate: true });

    // ----- my colour in this room -----
    async function chooseColor(i) {
      if (!myMember.value || myMember.value.color === i) return;
      try { await setMyColor(i); } catch (e) { say(explain(e), 'error'); }
    }
    const swatchLabel = (c, i, taken) => c.name + (taken.includes(i) ? ' (มีคนใช้แล้ว)' : '');
    async function submitInvite() {
      const n = inv.name.replace(/\s+/g, ' ').trim();
      if (!n) return;
      inv.busy = true;
      try { inv.lastCode = await createInvite(n.slice(0, 30), inv.color); inv.name = ''; }
      catch (e) { say(explain(e), 'error'); }
      inv.busy = false;
    }
    const link = (code) => location.origin + location.pathname + '#j-' + room.data.joinCode + '-' + code;
    async function copy(text, done) {
      try { await navigator.clipboard.writeText(text); say(done); } catch { say('คัดลอกไม่ได้ กดค้างที่ข้อความเพื่อคัดลอกเอง', 'error'); }
    }
    const pending = computed(() => room.invites.filter((i) => !i.claimedBy));

    async function rotate() {
      try { const c = await rotateRoomCode(); say('รหัสห้องใหม่: ' + prettyCode(c)); } catch (e) { say(explain(e), 'error'); }
    }
    async function leave() {
      try { await leaveRoom(); location.hash = ''; } catch (e) { say(explain(e), 'error'); }
    }
    async function destroy() {
      try { await deleteRoom(); location.hash = ''; say('ลบห้องแล้ว'); } catch (e) { say(explain(e), 'error'); }
    }

    const canManage = (m) => isHost.value && m.role !== 'owner' && !(myMember.value && m.uid === myMember.value.uid);

    return {
      room, myMember, isHost, isOwner, people, blocked, openMenu, confirm, act, inv, submitInvite, link, copy, pending, rotate, leave, destroy,
      COLORS, chipStyle, prettyCode, canManage, takenColors, inUse, chooseColor, swatchLabel, setRole, blockMember, unblockMember, removeMember, deleteInvite, session,
    };
  },
  template: /* html */ `
  <section class="stack" style="gap: 16px">
    <a v-if="room.data" :href="'#r-' + room.id" class="small muted row" style="text-decoration: none; gap: 4px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>
      {{ room.data && room.data.name }}
    </a>
    <h1>สมาชิก {{ people.length }} คน</h1>

    <div class="meet-grid" v-if="room.data">
      <div class="stack">
        <ul class="sheet" style="list-style: none; margin: 0; padding: 4px 0">
          <li v-for="(m, i) in people" :key="m.pid" :style="(i ? 'border-top: 1px solid var(--line); ' : '') + 'padding: 10px 14px'">
            <div class="row">
              <span class="chip lg" :class="{ me: myMember && m.uid === myMember.uid }" :style="chipStyle(m.color)">{{ m.name.charAt(0) }}</span>
              <span class="grow"><b>{{ m.name }}</b><span v-if="myMember && m.uid === myMember.uid" class="muted"> (คุณ)</span><br>
                <span class="small muted">{{ m.kind === 'guest' ? 'รหัสส่วนตัว' : 'Google' }}</span></span>
              <span class="tag" v-if="m.role === 'owner'">เจ้าของ</span>
              <span class="tag" v-else-if="m.role === 'cohost'">co-host</span>
              <button v-if="canManage(m)" class="icon-btn" :aria-label="'จัดการ ' + m.name" :aria-expanded="openMenu === m.uid" @click="openMenu = openMenu === m.uid ? '' : m.uid">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle></svg>
              </button>
            </div>
            <div v-if="openMenu === m.uid" class="row" style="margin-top: 10px">
              <button v-if="isOwner && m.kind === 'member'" class="btn sm" @click="setRole(m, m.role === 'cohost' ? 'participant' : 'cohost')">{{ m.role === 'cohost' ? 'เลิก co-host' : 'ตั้ง co-host' }}</button>
              <button class="btn sm" @click="act('rm-' + m.uid, () => removeMember(m), 'นำออกแล้ว')">{{ confirm.key === 'rm-' + m.uid ? 'กดอีกครั้งเพื่อนำออก' : (m.kind === 'guest' ? 'ยกเลิกรหัสและนำออก' : 'นำออก') }}</button>
              <button class="btn sm danger" @click="act('bl-' + m.uid, () => blockMember(m), 'บล็อกแล้ว')">{{ confirm.key === 'bl-' + m.uid ? 'กดอีกครั้งเพื่อบล็อก' : 'บล็อก' }}</button>
            </div>
          </li>
        </ul>
        <p class="small muted" style="margin: 0" v-if="isHost">นำออก: คนที่เข้าด้วย Google กลับเข้ามาได้ด้วยรหัสห้อง ส่วน guest ต้องได้รหัสใหม่ บล็อก: กลับเข้าห้องนี้ไม่ได้อีก</p>

        <div class="sheet" v-if="myMember && myMember.kind === 'member'">
          <h2>สีของคุณในห้องนี้</h2>
          <p class="small muted" style="margin: 0">สีที่มีจุดคือมีคนในห้องใช้แล้ว เปลี่ยนตรงนี้มีผลแค่ห้องนี้</p>
          <div class="swatches">
            <button v-for="(c, i) in COLORS" :key="i" type="button" class="swatch" :class="{ taken: takenColors.includes(i) }" :style="{ background: c.hex }" :aria-label="swatchLabel(c, i, takenColors)" :aria-pressed="myMember.color === i" @click="chooseColor(i)"></button>
          </div>
        </div>

        <div class="sheet" v-if="isHost && blocked.length">
          <h2>ถูกบล็อก</h2>
          <div v-for="m in blocked" :key="m.uid" class="row between">
            <span>{{ m.name }} <span class="small muted">({{ m.kind === 'guest' ? 'รหัสส่วนตัว' : 'Google' }})</span></span>
            <button class="btn sm" v-if="m.kind === 'member'" @click="unblockMember(m)">ปลดบล็อก</button>
          </div>
        </div>
      </div>

      <div class="stack">
        <form class="sheet" v-if="isHost" @submit.prevent="submitInvite">
          <h2>เชิญเพื่อนที่ไม่ใช้ Google</h2>
          <p class="small muted" style="margin: 0">สร้างรหัสส่วนตัวให้ 1 คน แล้วส่งลิงก์ให้เขา เข้าได้ทันทีโดยไม่ต้องสมัคร</p>
          <div class="field"><label for="iname">ชื่อ</label><input id="iname" class="input" v-model="inv.name" maxlength="30" placeholder="เช่น ต้น"></div>
          <div class="swatches">
            <button v-for="(c, i) in COLORS" :key="i" type="button" class="swatch" :class="{ taken: inUse.includes(i) }" :style="{ background: c.hex }" :aria-label="swatchLabel(c, i, inUse)" :aria-pressed="inv.color === i" @click="inv.color = i"></button>
          </div>
          <button class="btn primary" type="submit" :disabled="inv.busy || !inv.name.trim()">สร้างลิงก์เชิญ</button>
        </form>

        <div class="sheet" v-if="isHost && pending.length">
          <h2>ลิงก์เชิญที่ยังไม่มีคนใช้</h2>
          <div v-for="i in pending" :key="i.code" class="item" :class="{ lead: i.code === inv.lastCode }">
            <span class="chip" :style="chipStyle(i.color)">{{ i.name.charAt(0) }}</span>
            <span class="grow"><b>{{ i.name }}</b><br><span class="small muted code-pill">{{ prettyCode(i.code) }}</span></span>
            <button class="btn sm primary" @click="copy(link(i.code), 'คัดลอกลิงก์เชิญ ' + i.name + ' แล้ว')">คัดลอก</button>
            <button class="btn sm ghost" @click="act('inv-' + i.code, () => deleteInvite(i.code), 'ยกเลิกลิงก์แล้ว')">{{ confirm.key === 'inv-' + i.code ? 'ยืนยัน' : 'ยกเลิก' }}</button>
          </div>
        </div>

        <div class="ink-band stack">
          <div class="small muted">รหัสห้อง (สำหรับคนที่มี Google)</div>
          <div class="code-pill" style="font-size: 24px">{{ prettyCode(room.data.joinCode) }}</div>
          <button v-if="isHost" class="btn sm" style="background: transparent; color: inherit; border-color: var(--on-ink-2); align-self: flex-start" @click="act('rotate', rotate)">
            {{ confirm.key === 'rotate' ? 'กดอีกครั้ง: รหัสเดิมจะใช้ไม่ได้' : 'เปลี่ยนรหัสห้อง' }}
          </button>
        </div>

        <div class="sheet">
          <button v-if="!isOwner" class="btn danger" @click="act('leave', leave)">{{ confirm.key === 'leave' ? 'กดอีกครั้งเพื่อออกจากห้อง' : 'ออกจากห้อง' }}</button>
          <button v-if="isOwner" class="btn danger" @click="act('delete', destroy)">{{ confirm.key === 'delete' ? 'กดอีกครั้ง: ลบห้องถาวร' : 'ลบห้อง' }}</button>
        </div>
      </div>
    </div>
  </section>`,
};
