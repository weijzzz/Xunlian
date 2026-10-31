import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LibraryProvider, preloadLibrary } from './lib/library'
import { autoEndStale } from './lib/session'
import { preloadSettings, SettingsProvider } from './lib/settings'

// 先把设置、动作库读进来，再结束超过 6 小时没动的训练，最后渲染
void Promise.all([preloadSettings(), preloadLibrary()])
  .then(() => autoEndStale().catch(() => {}))
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <SettingsProvider>
          <LibraryProvider>
            <App />
          </LibraryProvider>
        </SettingsProvider>
      </StrictMode>,
    )
  })
