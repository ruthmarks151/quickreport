import * as nunjucks from "nunjucks";
import { forms } from "./forms";
import * as fs from "fs";

nunjucks.configure({ autoescape: true });

const allForms = Object.entries(forms).map(([id, { label }]) => ({
  id,
  label,
}));

for (const formType in forms) {
  fs.writeFile(
    `./public/${formType}.html`,
    nunjucks.render("baseFormPage.html", {
      ...forms[formType],
      id: formType,
      allForms: allForms.map((f) =>
        f.id === formType ? { ...f, selected: true } : f
      ),
    }),
    (err) => {
      if (err) throw err;
      console.log(`Saved ${formType}`);
    }
  );
}
