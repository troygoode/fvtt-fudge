const MAX_ATTEMPTS = 1000;
const TARGET_FORMAT = /([^\d]*)[\s]*([\d]+)/;

const whisperError = (error) => {
  console.error(`Forget VTT | Fudge | ${error}`);
  ChatMessage.create({
    user: game.user._id,
    whisper: [game.user._id],
    flavor: "Fudge",
    content: `<div>Error: ${error}</div>`
  });
};

const parseTarget = (target) => {
  const match = target.match(TARGET_FORMAT);
  const condition = match[1].trim();
  const value = parseInt(match[2].trim());
  switch (condition) {
    case "lt":
    case "<":
      return {
        condition: "lt",
        value
      };
    case "lte":
    case "<=":
      return {
        condition: "lte",
        value
      };
    case "gt":
    case ">":
      return {
        condition: "gt",
        value
      };
    case "gte":
    case ">=":
      return {
        condition: "gte",
        value
      };
    case "":
    case "eq":
    case "=":
    case "==":
    case "===":
      return {
        condition: "eq",
        value
      };
    default:
      return undefined;
  };
};

const parseDialogDoc = (doc) => {
  try {
    const formula = doc.find("input[name=formula]")[0].value;
    const target = parseTarget(doc.find("input[name=target]")[0].value);
    return {
      formula,
      target
    };
  } catch (e) {
    console.error(e);
    return {
      formula: undefined,
      target: undefined
    };
  }
}

const evaluateTotalVsTarget = (total, target) => {
  switch (target.condition) {
    case "eq":
      return total === target.value;
    case "gt":
      return total > target.value;
    case "gte":
      return total >= target.value;
    case "lt":
      return total < target.value;
    case "lte":
      return total <= target.value;
  }
};

const onSubmit = async (doc) => {
  const { formula, target } = parseDialogDoc(doc);
  if (!formula) {
    return whisperError("Missing Formula");
  }
  if (!target || !target.condition) {
    return whisperError("Invalid Target Format");
  }

  try {
    new Roll(formula).roll();
  } catch (e) {
    console.error(e);
    return whisperError("Invalid Formula");
  }

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const dice = new Roll(formula);
    const r = dice.roll();
    const total = r.total;
    if (evaluateTotalVsTarget(total, target)) {
      r.toMessage({
        speaker: ChatMessage.getSpeaker()
      }, {
        rollMode: "roll"
      });
      console.log(`Foundry VTT | Fudge | Fudged in ${i+1} attempts.`);
      return;
    }
  }
  whisperError("Max Attempts Reached");
};

const showDialog = async () => {
  const html = await renderTemplate("/modules/fudge/templates/dialog.html");
  return new Promise((resolve) => {
    new Dialog({
      title: 'Fudge',
      content: html,
      buttons: {
        roll: {
          label: "Roll",
          callback: async (input) => {
            resolve(await onSubmit(input));
          }
        }
      },
      default: "roll",
      close: () => resolve(null),
      render: (doc) => {
        doc.find("input[name=formula]")[0].focus();
      }
    }).render(true);
  });
}

Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) {
    return;
  }

  const bar = controls.find((c) => c.name === "token");
  bar.tools.push({
    name: "fudge",
    title: "Fudge",
    icon: "fas fa-poo",
    onClick: () => showDialog(),
    button: true
  });
});
