import parties from './parties.js'


let selectParty = document.querySelector('#select-party')


for(let party of parties.map(party => party.name).sort()) {
    let option = document.createElement('option')
    option.value = option.textContent = party
    selectParty.appendChild(option)
}