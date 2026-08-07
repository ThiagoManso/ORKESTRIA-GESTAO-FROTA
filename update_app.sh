#!/bin/bash
# First replace the imports
sed -i "s/export default function App() {/export default function App() {\n  const [isExternal, setIsExternal] = useState(false);\n\n  useEffect(() => {\n    const params = new URLSearchParams(window.location.search);\n    if (params.get('view') === 'external-request') {\n      setIsExternal(true);\n    }\n  }, []);\n\n  if (isExternal) {\n    return (\n      <APIProvider apiKey={API_KEY} version=\"weekly\">\n        <ExternalRequestPage \/>\n      <\/APIProvider>\n    );\n  }/" src/App.tsx
