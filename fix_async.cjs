const fs = require('fs');

let dash = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');
dash = dash.replace(
  /onClick=\{\(\) => \{\n\s*const today = new Date\(\)/,
  "onClick={async () => {\n              const today = new Date()"
);
fs.writeFileSync('src/components/DashboardView.tsx', dash);

let coll = fs.readFileSync('src/components/CollectionsView.tsx', 'utf8');
coll = coll.replace(
  /onClick=\{\(\) => \{\n\s*if \(!dateFilter\)/,
  "onClick={async () => {\n              if (!dateFilter)"
);
fs.writeFileSync('src/components/CollectionsView.tsx', coll);
