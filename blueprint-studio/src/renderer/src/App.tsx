import { useStudio } from './store'
import { Home } from './components/Home'
import { Editor } from './components/Editor'

export default function App(): React.JSX.Element {
  const blueprint = useStudio((s) => s.blueprint)
  return blueprint ? <Editor /> : <Home />
}
