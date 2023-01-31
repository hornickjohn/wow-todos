let profInfo = [];

let token = '';
const outputBlock = document.getElementById('output');
fetch('/token')
    .then(function (response) {
        return response.json();
    })
    .then(function (data) {
        token = data;
    });    

function Go() {
    const server = document.getElementById('server').value.trim().toLowerCase();
    const character = document.getElementById('character').value.trim().toLowerCase();
    if(character === '' || server === '' || token === '') {
        return;
    }
    fetch(`https://us.api.blizzard.com/profile/wow/character/${server}/${character}/professions?namespace=profile-us&locale=en_US&access_token=${token}`)
        .then(function (response) {
            if(response.status < 400) {
                return response.json();
            } else {
                return "Error - " + response.status;
            }
        })
        .then(function (data) {
            console.log(data);
            if(typeof data == 'string') {
                outputBlock.textContent = data;
            } else {
                profInfo = [];
                if(data.primaries) {
                    for(let profInd = 0; profInd < data.primaries.length; profInd++) {
                        data.primaries[profInd].tiers.forEach(tier => {
                            if(tier.tier.name.toLowerCase().includes('dragon isles')) {
                                profInfo.push(tier);
                            }
                        });
                    }
                } else {
                    outputBlock.textContent = "Character has no primary professions.";
                }
                //TODO handle if there are TWO professions, letting them pick one

                DisplayProf(0);
            }
        });
}

function DisplayProf(index) {
    outputBlock.innerHTML = "";
    const table = document.createElement('table');
    
    const thead = document.createElement('thead');
    const th1 = document.createElement('th');
    const th2 = document.createElement('th');
    const th3 = document.createElement('th');
    th1.textContent = 'Recipe';
    th2.textContent = 'Normal Reagents';
    th3.textContent = 'Ranked Reagents';
    thead.append(th1);
    thead.append(th2);
    thead.append(th3);

    const tbody = document.createElement('tbody');

    profInfo[index].known_recipes.forEach(recipeLink => {
        fetch(HrefCleanser(recipeLink.key.href))
            .then(function (response) {
                if(response.status < 400) {
                    return response.json();
                } else {
                    return "Error - " + response.status;
                }
            })
            .then(function (data) {
                if(typeof data == 'string') {
                    outputBlock.textContent = data;
                } else {
                    const row = document.createElement('tr');

                    const td1 = document.createElement('td');
                    td1.textContent = data.name;

                    const td2 = document.createElement('td');

                    if(data.reagents) {
                        data.reagents.forEach(async reagent => {
                            if(reagent.quantity > 0) {
                                let img = await HandleOne(reagent.reagent, false);
                                td2.append(img);
                            }
                        });
                    }
                    
                    const td3 = document.createElement('td');
                    if(data.modified_crafting_slots) {
                        data.modified_crafting_slots.forEach(async slot => {
                            let img = await HandleOne(slot.slot_type, true);
                            td3.append(img);
                        });
                    }



                    //create td3, add special mats to it, and append it below to the row
                    row.append(td1);
                    row.append(td2);
                    row.append(td3);
                    tbody.append(row);
                }
            });
    });

    table.append(thead);
    table.append(tbody);

    outputBlock.append(table);
}

//TODO if modified crafting reagent, we must get the name and do an item search and parse through that information to find an id/media
async function HandleOne(reagent, isMod) {
    let mat;
    let itemName = 'fetchfail';
    let desc = 'fetchfail';
    await fetch(HrefCleanser(reagent.key.href))
    .then(function (response) {
        if(response.status < 400) {
            return response.json();
        } else {
            return "Error - " + response.status;
        }
    })
    .then(async function (itemData) {
        if(typeof data == 'string') {
            console.log(data);
            console.log('^ occurred trying to fetch item data for id: ' + reagent.id);
        } else {
            if(!isMod) {
                mat = itemData;
                itemName = mat.name;
                desc = itemName;
            } else {
                if(itemData.compatible_categories && itemData.compatible_categories.length === 1) {
                    itemName = itemData.compatible_categories[0].name;
                    desc = itemName;
                    if(itemName.en_US) {
                        itemName = itemName.en_US;
                    }
                    await fetch(`https://us.api.blizzard.com/data/wow/search/item?namespace=static-us&_pageSize=1000&name.en_US=${itemName.replace(' ','%20')}&orderby=id&_page=1&access_token=${token}`)
                    .then(function (response) {
                        return response.json();
                    })
                    .then(function (searchData) {
                        searchData.results.forEach(result => {
                            if(!mat && (result.data.name.en_US === itemName || result.data.name === itemName)) {
                                mat = result.data;
                            }
                        });
                    });
                } else if(itemData.compatible_categories) {
                    desc = itemData.description.en_US;
                    if(!desc) {
                        desc = itemData.description;
                    }
                    //search each sub-item and set mat to the array, later check if it's an array and handle that as a dropdown menu of sorts
                    mat = [];
                    itemData.compatible_categories.forEach(async category => {
                        itemName = category.name;
                        if(itemName.en_US) {
                            itemName = itemName.en_US;
                        }
                        await fetch(`https://us.api.blizzard.com/data/wow/search/item?namespace=static-us&_pageSize=1000&name.en_US=${itemName.replace(' ','%20')}&orderby=id&_page=1&access_token=${token}`)
                        .then(function (response) {
                            return response.json();
                        })
                        .then(function (searchData) {
                            let found = false;
                            searchData.results.forEach(result => {
                                if(!found && (result.data.name.en_US === itemName || result.data.name === itemName)) {
                                    found = true;
                                    mat.push(result.data);
                                }
                            });
                        });
                    });
                }
            }
        }
    });
    
    //mat is the item page for the material
    let img;

    if(typeof mat.length !== 'undefined') {
        //create a base image
        img = document.createElement('img');
        img.setAttribute('title', desc);
        img.setAttribute('src','/images/expico.png');
        img.setAttribute('data-subs', JSON.stringify(mat));
        img.addEventListener('click',ExpandMat);
        //when base image is clicked, a modal type thing pops up displaying an image for each sub item
        //also include a "nothing" option in the modal
        //when any option in the modal is clicked, it puts that image into the base image
    } else {
        await fetch('https://us.api.blizzard.com/data/wow/media/item/' + mat.id + '?namespace=static-us&locale=en_US&access_token=' + token)
        .then(function (response) {
            if(response.status < 400) {
                return response.json();
            } else {
                return "Error - " + response.status;
            }
        })
        .then(async function (itemData) {
            if(typeof data == 'string') {
                console.log(data);
                console.log('^ occurred trying to fetch item media for id: ' + mat.id);
            } else {
                img = await GetImage(itemData);
                img.setAttribute('title', desc);
            }
        });
    }

    return img;
}

function ExpandMat(event) {
    let itemArray = JSON.parse(event.target.getAttribute('data-subs'));
    console.log(itemArray);
}

async function GetImage(itemData) {
    let rv = document.createElement('img');
    itemData.assets.forEach(asset => {
        if(asset.key === 'icon') {
            rv.setAttribute('src', asset.value);
        }
    });
    return rv;
}

function HrefCleanser(link) {
    const pieces = link.split('namespace');
    const rightpieces = pieces[1].split('-');
    let rv = pieces[0];
    rv += 'namespace' + rightpieces[0];
    if(!rightpieces[1].includes('.')) {
        rv += '-' + rightpieces[1];
    }
    for(let i = 2; i < rightpieces.length; i++) {
        rv += '-' + rightpieces[i];
    }
    rv += `&locale=en_US&access_token=${token}`;
    return rv;
}