import { ref, reactive, computed, watch } from 'vue';
import {
  room, openRoom, watchInvites, myMember, isHost, isOwner, people, takenColors, setMyColor, setScope, setInviteScope,
  createInvite, deleteInvite, setRole, blockMember, unblockMember, removeMember, rotateRoomCode, leaveRoom, deleteRoom, renameRoom,
  gangLink, guestLink, ROLE_LABEL, say, explain,
} from '../store.js';
import { COLORS, chipStyle, freeColor } from '../lib/palette.js';
import { prettyCode } from '../lib/codes.js';
import { shareText, copyText } from '../lib/share.js';
import EditableTitle from '../components/EditableTitle.js';

export default {
  name: 'ManageView',
  components: { EditableTitle },
  props: { roomId: String },
  setup(props) {
    watch(() => props.roomId, (id) => openRoom(id), { immediate: true });
    let watching = false;
    watch(isHost, (h) => { if (h && !watching) { watching = true; watchInvites(); } }, { immediate: true });

    const confirm = ref('');
    async function act(key, fn, done) {
      if (confirm.value !== key) { confirm.value = key; return; }
      confirm.value = '';
      try { await fn(); if (done) say(done); } catch (e) { say(explain(e), 'error'); }
    }
    async function send(text, done) {
      const r = await shareText(text);
      if (r === 'copied') say(done);
      else if (!r && !navigator.share) say('คัดลอกไม่ได้ กดค้างที่ข้อความเพื่อคัดลอกเอง', 'error');
    }
    const meetTitle = (id) => (room.meetups.find((x) => x.id === id) || {}).title || 'นัดที่ลบแล้ว';

    // ----- ลิงก์แก๊ง -----
    const gangMessage = computed(() => room.data
      ? 'มาเข้าแก๊ง "' + room.data.name + '" ใน ว่างไหม กันนะ\n' + gangLink(room.data.joinCode) : '');
    async function rotate() {
      try { const c = await rotateRoomCode(); say('ลิงก์แก๊งใหม่พร้อมแล้ว (รหัส ' + prettyCode(c) + ')'); } catch (e) { say(explain(e), 'error'); }
    }

    // ----- ลิงก์ส่วนตัว -----
    const inv = reactive({ name: '', color: 0, meetId: '', busy: false, lastCode: '' });
    const inUse = computed(() => [...people.value.map((p) => p.color), ...room.invites.filter((i) => !i.claimedBy).map((i) => i.color)]);
    watch(() => inUse.value.join(','), () => { inv.color = freeColor(inUse.value); }, { immediate: true });
    async function submitInvite() {
      const n = inv.name.replace(/\s+/g, ' ').trim();
      if (!n) return;
      inv.busy = true;
      try { inv.lastCode = await createInvite(n.slice(0, 30), inv.color, inv.meetId || null); inv.name = ''; }
      catch (e) { say(explain(e), 'error'); }
      inv.busy = false;
    }
    const pending = computed(() => room.invites.filter((i) => !i.claimedBy));
    const personalMessage = (i) => (i.meetId ? 'ว่างไหม? 📅 ' + meetTitle(i.meetId) : 'มาเข้าแก๊ง "' + room.data.name + '" ใน ว่างไหม กันนะ')
      + '\nลิงก์ของ ' + i.name + ' (ของคุณคนเดียว อย่าส่งต่อนะ)\n' + guestLink(i.code);
    async function changeInviteScope(i, meetId) {
      try { await setInviteScope(i.code, meetId); } catch (e) { say(explain(e), 'error'); }
    }

    // ----- สมาชิก -----
    const openMenu = ref('');
    const canManage = (m) => isHost.value && m.role !== 'owner' && !(myMember.value && m.uid === myMember.value.uid);
    const blocked = computed(() => room.members.filter((m) => m.status === 'blocked'));
    const gangCount = computed(() => people.value.filter((p) => !p.meetId).length);
    const guestCount = computed(() => people.value.length - gangCount.value);
    async function changeScope(m, meetId) {
      try { await setScope(m, meetId); say(meetId ? m.name + ' เป็นแขกของ "' + meetTitle(meetId) + '"' : m.name + ' อยู่ในแก๊งแล้ว'); }
      catch (e) { say(explain(e), 'error'); }
    }
    async function toggleCohost(m) {
      try { await setRole(m, m.role === 'cohost' ? 'participant' : 'cohost'); } catch (e) { say(explain(e), 'error'); }
    }

    // ----- แก๊งนี้ -----
    async function chooseColor(i) {
      if (!myMember.value || myMember.value.color === i) return;
      try { await setMyColor(i); } catch (e) { say(explain(e), 'error'); }
    }
    const swatchLabel = (c, i, taken) => c.name + (taken.includes(i) ? ' (มีคนใช้แล้ว)' : '');
    async function rename(name) {
      try { await renameRoom(name); say('เปลี่ยนชื่อแก๊งแล้ว'); } catch (e) { say(explain(e), 'error'); }
    }
    async function leave() { await leaveRoom(); location.hash = ''; }
    async function destroy() { await deleteRoom(); location.hash = ''; }

    return {
      room, myMember, isHost, isOwner, people, blocked, gangCount, guestCount, openMenu, confirm, act, send, meetTitle,
      gangMessage, rotate, inv, inUse, submitInvite, pending, personalMessage, changeInviteScope, canManage, changeScope, toggleCohost,
      takenColors, chooseColor, swatchLabel, rename, leave, destroy, blockMember, unblockMember, removeMember, deleteInvite,
      COLORS, chipStyle, prettyCode, gangLink, copyText, ROLE_LABEL,
    };
  },
  template: /* html */ `
  <section class="stack" style="gap: 16px">
    <a v-if="room.data" :href="'#r-' + room.id" class="small muted row" style="text-decoration: none; gap: 4px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>
      {{ room.data.name }}
    </a>
    <h1>จัดการแก๊ง</h1>

    <div class="meet-grid" v-if="room.data && myMember">
      <div class="stack" style="gap: 16px">
        <!-- ชวนเข้าแก๊ง -->
        <section v-if="isHost" class="stack" aria-labelledby="invite-h">
          <h2 id="invite-h" style="font-size: 16px">ชวนเข้าแก๊ง</h2>
          <div class="ink-band stack">
            <b>ลิงก์แก๊ง</b>
            <span class="small muted">ส่งลงกลุ่มได้ เพื่อนล็อกอิน Google แล้วกดรับคำชวนก็เข้าแก๊ง</span>
            <span class="small" style="overflow-wrap: anywhere">{{ gangLink(room.data.joinCode) }}</span>
            <div class="row">
              <button class="btn sm" style="background: var(--on-ink); color: var(--ink); border: 0" @click="send(gangMessage, 'คัดลอกลิงก์แก๊งแล้ว')">ส่งลิงก์แก๊ง</button>
              <button class="btn sm" style="background: transparent; color: inherit; border-color: var(--on-ink-2)" @click="act('rotate', rotate)">
                {{ confirm === 'rotate' ? 'กดอีกครั้ง: ลิงก์เดิมจะใช้ไม่ได้' : 'เปลี่ยนลิงก์' }}
              </button>
            </div>
            <span class="small muted">รหัสแก๊ง <span class="code-pill">{{ prettyCode(room.data.joinCode) }}</span></span>
          </div>

          <form class="sheet" @submit.prevent="submitInvite">
            <b>ลิงก์ส่วนตัว</b>
            <span class="small muted" style="margin-top: -6px">สำหรับคนที่ไม่ใช้ Google ตั้งชื่อกับสีให้เขา กดครั้งเดียวเข้าได้เลย</span>
            <div class="row">
              <input class="input grow" v-model="inv.name" maxlength="30" placeholder="ชื่อเพื่อน" aria-label="ชื่อเพื่อน">
              <button class="btn primary" type="submit" :disabled="inv.busy || !inv.name.trim()">สร้างลิงก์</button>
            </div>
            <div class="swatches">
              <button v-for="(c, i) in COLORS" :key="i" type="button" class="swatch" :class="{ taken: inUse.includes(i) }" :style="{ background: c.hex }" :aria-label="swatchLabel(c, i, inUse)" :aria-pressed="inv.color === i" @click="inv.color = i"></button>
            </div>
            <div class="field" v-if="room.meetups.length">
              <label for="iscope">เข้าเป็น</label>
              <select id="iscope" class="input" v-model="inv.meetId">
                <option value="">สมาชิกแก๊ง (ทุกนัด)</option>
                <option v-for="x in room.meetups" :key="x.id" :value="x.id">แขกเฉพาะ {{ x.title }}</option>
              </select>
            </div>
          </form>
        </section>

        <!-- สมาชิก -->
        <section class="stack" aria-labelledby="members-h">
          <h2 id="members-h" style="font-size: 16px">สมาชิก {{ gangCount }} คน<template v-if="guestCount"> · แขก {{ guestCount }}</template></h2>
          <ul class="sheet" style="list-style: none; margin: 0; padding: 4px 0; gap: 0">
            <li v-for="(m, i) in people" :key="m.pid" :style="(i ? 'border-top: 1px solid var(--line); ' : '') + 'padding: 10px 14px'">
              <div class="row" style="flex-wrap: nowrap">
                <span class="chip lg" :class="{ me: m.uid === myMember.uid }" :style="chipStyle(m.color)">{{ m.name.charAt(0) }}</span>
                <span class="grow"><b>{{ m.name }}</b><span v-if="m.uid === myMember.uid" class="muted"> (คุณ)</span><br>
                  <span class="small muted">{{ m.kind === 'guest' ? 'ลิงก์ส่วนตัว' : 'Google' }}</span></span>
                <span class="tag" v-if="m.meetId">แขก · {{ meetTitle(m.meetId) }}</span>
                <span class="tag" v-else-if="m.role !== 'participant'">{{ ROLE_LABEL[m.role] }}</span>
                <button v-if="canManage(m)" class="icon-btn" :aria-label="'จัดการ ' + m.name" :aria-expanded="openMenu === m.uid" @click="openMenu = openMenu === m.uid ? '' : m.uid">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle></svg>
                </button>
              </div>
              <div v-if="openMenu === m.uid" class="row" style="margin-top: 10px">
                <button v-if="isOwner && m.kind === 'member' && !m.meetId" class="btn sm" @click="toggleCohost(m)">{{ m.role === 'cohost' ? 'เลิกเป็นผู้ดูแลแก๊ง' : 'ตั้งเป็นผู้ดูแลแก๊ง' }}</button>
                <label v-if="m.role === 'participant' && room.meetups.length" class="row small" style="gap: 6px">
                  เข้าเป็น
                  <select class="input" style="width: auto; min-height: 36px; padding: 0 8px" :value="m.meetId || ''" @change="changeScope(m, $event.target.value)">
                    <option value="">สมาชิกแก๊ง</option>
                    <option v-for="x in room.meetups" :key="x.id" :value="x.id">แขกเฉพาะ {{ x.title }}</option>
                  </select>
                </label>
                <button class="btn sm" @click="act('rm-' + m.uid, () => removeMember(m), 'นำออกแล้ว')">{{ confirm === 'rm-' + m.uid ? 'กดอีกครั้งเพื่อนำออก' : 'นำออก' }}</button>
                <button class="btn sm danger" @click="act('bl-' + m.uid, () => blockMember(m), 'บล็อกแล้ว')">{{ confirm === 'bl-' + m.uid ? 'กดอีกครั้งเพื่อบล็อก' : 'บล็อก' }}</button>
              </div>
            </li>
          </ul>
          <p class="small muted" style="margin: 0" v-if="isHost">นำออก: คนที่ใช้ Google กลับเข้ามาได้ถ้ามีลิงก์แก๊ง คนที่ใช้ลิงก์ส่วนตัวต้องได้ลิงก์ใหม่ · บล็อก: กลับเข้าแก๊งนี้ไม่ได้อีก</p>
        </section>
      </div>

      <div class="stack" style="gap: 16px">
        <section v-if="isHost && pending.length" class="stack" aria-labelledby="pending-h">
          <h2 id="pending-h" style="font-size: 16px">ลิงก์ที่ยังไม่มีคนใช้</h2>
          <div v-for="i in pending" :key="i.code" class="item" :class="{ lead: i.code === inv.lastCode }">
            <span class="chip lg" :style="chipStyle(i.color)">{{ i.name.charAt(0) }}</span>
            <span class="grow"><b>{{ i.name }}</b><br>
              <select v-if="room.meetups.length" class="input small" style="width: auto; min-height: 32px; padding: 0 6px; margin-top: 4px" :aria-label="'เข้าเป็น (' + i.name + ')'" :value="i.meetId || ''" @change="changeInviteScope(i, $event.target.value)">
                <option value="">สมาชิกแก๊ง</option>
                <option v-for="x in room.meetups" :key="x.id" :value="x.id">แขก · {{ x.title }}</option>
              </select>
              <span v-else class="small muted code-pill">{{ prettyCode(i.code) }}</span></span>
            <button class="btn sm primary" @click="send(personalMessage(i), 'คัดลอกลิงก์ของ ' + i.name + ' แล้ว')">ส่ง</button>
            <button class="btn sm ghost" @click="act('inv-' + i.code, () => deleteInvite(i.code), 'ยกเลิกลิงก์แล้ว')">{{ confirm === 'inv-' + i.code ? 'ยืนยัน' : 'ยกเลิก' }}</button>
          </div>
        </section>

        <section v-if="isHost && blocked.length" class="sheet">
          <h2 style="font-size: 16px">ถูกบล็อก</h2>
          <div v-for="m in blocked" :key="m.uid" class="row between">
            <span>{{ m.name }} <span class="small muted">({{ m.kind === 'guest' ? 'ลิงก์ส่วนตัว' : 'Google' }})</span></span>
            <button class="btn sm" v-if="m.kind === 'member'" @click="unblockMember(m)">ปลดบล็อก</button>
          </div>
        </section>

        <section class="stack" aria-labelledby="gang-h">
          <h2 id="gang-h" style="font-size: 16px">แก๊งนี้</h2>
          <div class="sheet">
            <template v-if="myMember.kind === 'member'">
              <span style="font-weight: 600">สีของฉัน</span>
              <span class="small muted" style="margin-top: -6px">สีที่มีจุดคือมีคนในแก๊งใช้แล้ว เปลี่ยนตรงนี้มีผลแค่แก๊งนี้</span>
              <div class="swatches">
                <button v-for="(c, i) in COLORS" :key="i" type="button" class="swatch" :class="{ taken: takenColors.includes(i) }" :style="{ background: c.hex }" :aria-label="swatchLabel(c, i, takenColors)" :aria-pressed="myMember.color === i" @click="chooseColor(i)"></button>
              </div>
            </template>
            <div v-if="isHost" class="stack" style="gap: 4px">
              <span style="font-weight: 600">ชื่อแก๊ง</span>
              <EditableTitle :value="room.data.name" :can-edit="true" :max="40" label="ชื่อแก๊ง" size="20px" @save="rename" />
            </div>
            <button v-if="!isOwner" class="btn danger" @click="act('leave', leave)">{{ confirm === 'leave' ? 'กดอีกครั้งเพื่อออกจากแก๊ง' : 'ออกจากแก๊ง' }}</button>
            <button v-if="isOwner" class="btn danger" @click="act('delete', destroy)">{{ confirm === 'delete' ? 'กดอีกครั้ง: ลบแก๊งและทุกนัดถาวร' : 'ลบแก๊ง' }}</button>
          </div>
        </section>
      </div>
    </div>
  </section>`,
};
