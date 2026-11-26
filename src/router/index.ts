import { createRouter, createWebHashHistory } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import CalendarView from '@/views/CalendarView.vue'
import ComingSoonView from '@/views/ComingSoonView.vue'
import AccountView from '@/views/AccountView.vue'
import SettingsView from '@/views/SettingsView.vue'

export default createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/',
      component: AppLayout,
      children: [
        { path: '', name: 'calendar', component: CalendarView },
        { path: 'account', component: AccountView },
        { path: 'stats', component: ComingSoonView, props: { title: '統計' } },
        { path: 'settings', name: 'settings', component: SettingsView },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
