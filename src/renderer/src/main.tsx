import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/theme.css'
import './styles/app.css'

// Nota: sin React.StrictMode a propósito — en desarrollo provocaba remontar
// componentes y dejaba paneles "fantasma" al cambiar de chat.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
