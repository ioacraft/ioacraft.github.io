// https://github.com/msqr1/Vosklet
const MODEL_NAME = "vosk-model-small-en-us-0.15"
const MODEL_URL = `assets/${MODEL_NAME}.tar.gz`

const params = new URL(window.location).searchParams

const endpoint = params.get("e") ?? "localhost:8080/spell"
const token = params.get("t") ?? ''
const spellData = params.get("s") ?? ''

// Format:
// SpellOne:transcription one,transcription two;SpellTwo:transcription
const decoded = atob(spellData)
const spells = { }

for (const spell of decoded.split(';')) {
    if (spell.trim().length < 1)
        continue;
    let name = spell.slice(0, spell.indexOf(':'))
    let transcriptions = spell.slice(name.length + 1).split(',')
    spells[name] = transcriptions

    console.log(`Spell "${name}" with transcriptions\n%O`, transcriptions)
}

async function recognise(event) {
    let result = event.detail.toLowerCase()

    for (const spellName of Object.keys(spells)) {
        for (const transcription of spells[spellName]) {
            if (transcription.toLowerCase() != result)
                continue;

            console.log(`Recognised spell ${spellName}" with transcription "${transcription}"`)
            document.getElementById("result").textContent = spellName

            await fetch(endpoint, { method: "POST", body: spellName, headers: { Authorization: token } })
                .then(response => console.log(`API request returned ${response.status}`))
                .catch(message => console.log(`API request error: ${message}`))

            break;
        }
    }

    console.log(`Could not recognise "${result}"`)
}

async function start() {
    document.getElementById("start").remove()

    let grammar = ['[']

    for (const transcriptions of Object.values(spells)) {
        for (const t of transcriptions)
            grammar.push('"', t, '"', ',')
    }

    grammar[grammar.length - 1] = ']'
    grammar = grammar.concat('')

    let ctx = new AudioContext({ sinkId: { type: "none" } })
    let micNode = ctx.createMediaStreamSource(await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1
        }
    }))

    let vosklet = await loadVosklet()
    let model = await vosklet.createModel(MODEL_URL, "English", MODEL_NAME)

    let recogniser = await vosklet.createRecogniser(model, ctx.sampleRate)
    recogniser.setGrm(grammar)
    recogniser.addEventListener("result", recognise)

    let transferer = await module.createTransferer(ctx, 128 * 150)
    transferer.port.onmessage = event => recogniser.acceptWaveform(event.data)
    micNode.connect(transferer)
}
