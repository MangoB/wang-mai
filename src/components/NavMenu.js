import { computed } from 'vue';
import { session, isGoogle, home, signOut } from '../store.js';
import { chipStyle } from '../lib/palette.js';

// The app menu: a drawer on phones (☰), a sidebar on wider screens that folds down to icons.
export default {
  name: 'NavMenu',
  props: {
    open: Boolean,      // phone drawer shown
    rail: Boolean,      // wide screen: icons only
    current: { type: String, default: '' }, // gang id on screen, or 'home'
  },
  emits: ['close', 'toggle-rail'],
  setup() {
    const me = computed(() => ({
      name: (session.profile && session.profile.name) || (home.gangs[0] && home.gangs[0].me.name) || 'ฉัน',
      color: (session.profile && session.profile.color) ?? (home.gangs[0] ? home.gangs[0].me.color : 7),
    }));
    const initial = (s) => (s || '?').charAt(0);
    return { session, isGoogle, home, me, initial, chipStyle, signOut };
  },
  template: /* html */ `
  <div v-if="open" class="scrim" @click="$emit('close')" aria-hidden="true"></div>
  <aside class="side" :class="{ open, rail }" aria-label="เมนู">
    <div class="side-head">
      <span class="chip lg" :style="chipStyle(me.color)" aria-hidden="true">{{ initial(me.name) }}</span>
      <span class="label stack" style="gap: 0">
        <b style="font-size: 17px">{{ me.name }}</b>
        <span class="small muted">{{ isGoogle ? 'Google' : 'ลิงก์ส่วนตัว' }}</span>
      </span>
    </div>

    <nav class="side-nav">
      <a href="#" class="nav-item" :aria-current="current === 'home' ? 'page' : null" title="หน้าแรก">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z"></path></svg>
        <span class="label">หน้าแรก</span>
      </a>
      <span class="label nav-section">แก๊งของฉัน</span>
      <a v-for="g in home.gangs" :key="g.id" :href="'#r-' + g.id" class="nav-item" :aria-current="current === g.id ? 'page' : null" :title="g.name">
        <span class="chip gang-chip" aria-hidden="true">{{ initial(g.name) }}</span>
        <span class="label grow">{{ g.name }}</span>
        <span class="label small muted" v-if="g.meetups.filter((m) => m.status === 'open').length">{{ g.meetups.filter((m) => m.status === 'open').length }} นัด</span>
      </a>
      <a v-if="isGoogle && session.profile" href="#new" class="nav-item" title="สร้างแก๊งใหม่">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>
        <span class="label">สร้างแก๊งใหม่</span>
      </a>
    </nav>

    <div class="side-foot">
      <button type="button" class="nav-item rail-toggle" :title="rail ? 'กางเมนู' : 'ย่อเมนู'" @click="$emit('toggle-rail')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path :d="rail ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'"></path></svg>
        <span class="label">ย่อเมนู</span>
      </button>
      <!-- Without Google, signing out would lose the identity behind personal links on this device. -->
      <button v-if="isGoogle" type="button" class="nav-item" title="ออกจากระบบ" @click="signOut">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"></path></svg>
        <span class="label">ออกจากระบบ</span>
      </button>
    </div>
  </aside>`,
};
