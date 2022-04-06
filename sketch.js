/*
Javscript implementation of https://github.com/AdrianMargel/evolving-ant-farm
*/

//---------------------------------
//         Basic Settings
//---------------------------------


//if food is displayed
const displayFood = false;
//if the color of the ant is displayed or the trail itself
const displayColor = true;
//if the ants move in eight directions or four
const eightDirections = true;
//if the food spawns in a disk
const foodDisk = true;
//if the map will have varied spawning rules for food (biomes)
const multiBiome = true;
//how transparent the ants are (0 to 255)
const opacity = 20;
//redraw the an ant's tiles after it dies
const redrawDead = false;
//how fast the hue of a species changes
const hueChange = 3;
//how fast the screen fades to black (0 to 255, generally works best set to 0 for no fade)
const fade = 0;






//the number of different types of tiles
const tileTypes = 5;


//---------------------------------


// //-------------Classes-------------




// //simple integer based vector class
class Vector {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }


  isSame(other) {
    return this.x === other.x && this.y === other.y;
  }


  static clone(vector) {
    return new Vector(vector.x, vector.y);
  }
}


//this class generates random numbers to be used in mutations
//the mutator class is also able to be mutated
class Mutator {
  constructor(s, h, mod) {
    this.spread = s;
    this.high = h;
    this.modifier = mod;
    this.fixedHigh = false;
  }


  //create a mutator based off another mutator
  static clone(clone) {
    let newClone = new Mutator(clone.spread, clone.high, clone.modifier)
    newClone.fixedHigh = clone.fixedHigh;
    return newClone;
  }


  //set high to be fixed
  fixHigh() {
    this.fixedHigh = true;
  }


  //mutate the mutator based on other mutators
  mutate(mutateMutateHigh, mutateMutateSpread, mutateMutateMod) {
    if (!this.fixedHigh) {
      if (Math.floor(random(0, 2)) === 1) {
        this.high += mutateMutateHigh.getValue();
      } else {
        this.high -= mutateMutateHigh.getValue();
      }
    }
    this.high = Math.max(this.high, 0.001);


    if (Math.floor(random(0, 2)) == 1) {
      this.spread += mutateMutateSpread.getValue();
    } else {
      this.spread -= mutateMutateSpread.getValue();
    }
    this.spread = Math.min(Math.max(this.spread, 1), 10);


    if (Math.floor(random(0, 2)) == 1) {
      this.modifier += mutateMutateMod.getValue();
    } else {
      this.modifier -= mutateMutateMod.getValue();
    }
    this.modifier = Math.max(this.modifier, 0);
  }


  //get the value for a seed number from 0 to 1
  getValue(_in) {
    if (_in == null) {
      _in = random(0, 1);
    }
    return (Math.pow(_in, this.spread) * Math.pow(this.high, 2) + _in * this.modifier * this.high) / (this.high + this.modifier);
  }


  //get an int value
  getIntValue() {
    return Math.floor(this.getValue());
  }
}


//this class checks for the existance of a certain tile type at a certain relative position
class Find {

  static clone(clone) {
    return new Find(clone.pos, clone.type);
  }

  constructor(p, t) {
    this.pos = Vector.clone(p);
    this.type = t;
  }


  //returns true if the tile type matches the expected type at position searched
  //the pos will be rotated based on direction to ensure that ants cannot form directional biases
  matches(grid, p, direction) {
    let xAdd = 0;
    let yAdd = 0;
    if (eightDirections) {
      direction /= 2;
      if (direction == 0) {
        xAdd = this.pos.x;
        yAdd = this.pos.y;
      } else if (direction == 1) {
        xAdd =- this.pos.y;
        yAdd = this.pos.x;
      } else if (direction == 2) {
        xAdd =- this.pos.x;
        yAdd =- this.pos.y;
      } else if (direction == 3) {
        xAdd = this.pos.y;
        yAdd =- this.pos.x;
      }
    } else {
      if (direction == 0) {
        xAdd = this.pos.x;
        yAdd = this.pos.y;
      } else if (direction == 1) {
        xAdd =- this.pos.y;
        yAdd = this.pos.x;
      } else if (direction == 2) {
        xAdd =- this.pos.x;
        yAdd =- this.pos.y;
      } else if (direction == 3) {
        xAdd = this.pos.y;
        yAdd =- this.pos.x;
      }
    }


    let x = p.x + xAdd;
    let y = p.y + yAdd;


    if (x < 0) {
      x = x + grid.length;
    }
    if (x >= grid.length) {
      x = x - grid.length;
    }
    if (y < 0) {
      y = y + grid[0].length;
    }
    if (y >= grid[0].length) {
      y = y - grid[0].length;
    }
    if (x>=0 && y>=0 && x<grid.length && y<grid[0].length) {
      return grid[x][y].type === this.type;
    }
    return false;
  }
}


//a rule will check for the existance of multiple tiles in a
class Rule {
  constructor(s, nt, t) {
    this.search = s;
    this.newType = nt;
    this.turn = t;
    this.alive = true;
    for (let i = 0; i < s.length; i++) {
      for (let j = i+1; j < s.length; j++) {
        if (s[i].pos.isSame(s[j]).pos) {
          this.alive=false;
        }
      }
    }
  }

  static clone(clone) {
    let newSearch = [];
    for (let i=0; i < clone.search.length; i++) {
      newSearch.push(Find.clone(clone.search[i]));
    }
    return new Rule(newSearch, clone.newType, clone.turn);
  }


  isAlive() {
    return this.alive;
  }


  //returns if the rule has found what it is searching for 
  matches(grid, pos, direction) {
    for (let i = 0; i < this.search.length; i++) {
      if (!this.search[i].matches(grid, pos, direction)) {
        return false;
      }
    }
    return true;
  }
}


//this is the class for the modified langton ants that create the ecosystem
class Ant {

  //create an ant from a parent
  constructor(p, parAnt) {
    //set random direction
    if (eightDirections) {
      this.direction = Math.floor(random(0, 8));
    } else {
      this.direction = Math.floor(random(0, 4));
    }

    this.pos = Vector.clone(p);
    //set to be alive
    this.alive = true;
    //init claimed array
    this.claimed = [];
    this.rules = [];
    
    if (parAnt === undefined) {
      //setup mutators
      this.addMut = new Mutator(1, 1, 0);
      this.rangeMut = new Mutator(1, 1, 0);
      this.remMut = new Mutator(1, 1, 0);
      this.shiftMut = new Mutator(1, 1, 0);
      this.shiftDistMut = new Mutator(1, 1, 0);
      this.complexMut = new Mutator(1, 1, 0);
      this.spreadMut = new Mutator(1, 1, 0);
      this.ageMut = new Mutator(1, 1, 0);
      this.mutateMutateHigh = new Mutator(1, 0.2, 0);
      this.mutateMutateSpread = new Mutator(1, 0.2, 0);
      this.mutateMutateMod = new Mutator(1, 0.2, 0);
      for (let i=0; i<100; i++) {
        this.mutMuts();
      }

      //set generic starting stats
      this.changeWeakness();
      this.ageMax = 1000;
      this.age = this.ageMax;
      this.hue = Math.floor(random(0, 256));

      //startup rules
      for (let i=0; i<30; i++) {
        this.addRuleStart();
      }
    } else {
      //set base stats to same as parent
      this.weakness = parAnt.weakness;
      this.ageMax = parAnt.ageMax;
      this.age = this.ageMax;
      //set the hue to be almost the same as the parent so that species are the same color
      this.hue = (parAnt.hue + Math.floor(random(-hueChange, hueChange))) % 256;
      if (hue < 0) {
        this.hue += 256;
      }


      //add rules
      for (let i=0; i < parAnt.rules.length; i++) {
        this.rules.push(Rule.clone(parAnt.rules[i]));
      }

      //copy parent's mutators
      this.addMut = Mutator.clone(parAnt.addMut);
      this.rangeMut = Mutator.clone(parAnt.rangeMut);
      this.remMut = Mutator.clone(parAnt.remMut);
      this.shiftMut = Mutator.clone(parAnt.shiftMut);
      this.shiftDistMut = Mutator.clone(parAnt.shiftDistMut);
      this.complexMut = Mutator.clone(parAnt.complexMut);
      this.spreadMut = Mutator.clone(parAnt.spreadMut);
      this.ageMut = Mutator.clone(parAnt.ageMut);

      this.mutateMutateHigh = Mutator.clone(parAnt.mutateMutateHigh);
      this.mutateMutateSpread = Mutator.clone(parAnt.mutateMutateSpread);
      this.mutateMutateMod = Mutator.clone(parAnt.mutateMutateMod);
    }
  }


  //mutate the ants
  mutate() {
    this.mutMuts();
    this.removeRules();
    this.addRules();
    this.shiftRules();


    /*
    //this code allows age to evolve
     int ageChange=ageMut.getIntValue();
     if(ageMutMut.getValue()>0.5){
     ageChange*=-1;
     }
     ageMax+=ageChange;
     */


    //very rarely allow weakness to change
    if (Math.floor(random(0, 1000) < 1)) {
      this.changeWeakness();
    }
  }


  //mutate the mutators
  mutMuts() {
    this.addMut.mutate(this.mutateMutateHigh, this.mutateMutateSpread, this.mutateMutateMod);
    this.rangeMut.mutate(this.mutateMutateHigh, this.mutateMutateSpread, this.mutateMutateMod);
    this.remMut.mutate(this.mutateMutateHigh, this.mutateMutateSpread, this.mutateMutateMod);
    this.shiftMut.mutate(this.mutateMutateHigh, this.mutateMutateSpread, this.mutateMutateMod);
    this.shiftDistMut.mutate(this.mutateMutateHigh, this.mutateMutateSpread, this.mutateMutateMod);
    this.complexMut.mutate(this.mutateMutateHigh, this.mutateMutateSpread, this.mutateMutateMod);
    this.spreadMut.mutate(this.mutateMutateHigh, this.mutateMutateSpread, this.mutateMutateMod);
    this.ageMut.mutate(this.mutateMutateHigh, this.mutateMutateSpread, this.mutateMutateMod);
  }


  //randomly add a random number of new rules
  addRules() {
    let add = this.addMut.getIntValue();
    for (let i=0; i < add; i++) {
      let tempRule;
      let temp = [];
      let rSize = Math.floor(random(1, this.complexMut.getIntValue()+1));
      for (let j=0; j < rSize; j++) {
        let spreadX = this.spreadMut.getIntValue();
        let spreadY = this.spreadMut.getIntValue();
        if (Math.floor(random(0, 2)) === 0) {
          spreadX *= -1;
        }
        if (Math.floor(random(0, 2)) === 0) {
          spreadY *= -1;
        }
        temp.push(new Find(new Vector(spreadX, spreadY), Math.floor(random(0, tileTypes+1))));
      }
      if(eightDirections){
        tempRule = new Rule(temp, Math.floor(random(0, tileTypes)), Math.floor(random(0, 8)));
      }else{
        tempRule = new Rule(temp, Math.floor(random(0, tileTypes)), Math.floor(random(0, 4)));
      }
      if (tempRule.isAlive()) {
        this.rules.splice(Math.floor(random(0, this.rules.length + 1)), 0, tempRule);
      }
    }
  }


  //add new rules for a new ant
  addRuleStart() {
    let tempRule;
    let temp = [];
    let rSize = Math.floor(random(1, 10));
    for (let j=0; j<rSize; j++) {
      let spreadX = Math.floor(random(0, 3));
      let spreadY = Math.floor(random(0, 3));
      if (Math.floor(random(0, 2)) == 0) {
        spreadX *= -1;
      }
      if (Math.floor(random(0, 2)) == 0) {
        spreadY *= -1;
      }
      temp.push(new Find(new Vector(spreadX, spreadY), Math.floor(random(0, tileTypes+1))));
    }
    if(eightDirections){
        tempRule = new Rule(temp, Math.floor(random(0, tileTypes)), Math.floor(random(0, 8)));
    }else{
        tempRule = new Rule(temp, Math.floor(random(0, tileTypes)), Math.floor(random(0, 4)));
    }
    if (tempRule.isAlive()) {
      this.rules.splice(Math.floor(random(0, this.rules.length+1)), 0, tempRule);
    }
  }


  //randomly remove rules
  removeRules() {
    let rem = Math.min(this.remMut.getIntValue(), this.rules.length);
    for (let i=0; i < rem; i++) {
      this.rules.splice(Math.floor(random(0, this.rules.length)), 1);
    }
  }


  //randomly shuffle the priority of the rules
  shiftRules() {
    let shift = Math.min(this.shiftMut.getIntValue(), this.rules.length);
    for (let i = 0; i < shift; i++) {
      let shiftId = Math.floor(random(0, this.rules.length));
      let shiftAmount = this.shiftDistMut.getIntValue();
      let temp = this.rules[shiftId];
      this.rules.splice(shiftId, 1);
      shiftId = Math.min(Math.max(shiftId+shiftAmount, 0), this.rules.length);
      this.rules.splice(shiftId, 0, temp);
    }
  }


  changeWeakness() {
    this.weakness = Math.floor(random(1, tileTypes));
  }


  //move the ant and apply the ant's rules
  move(map) {
    //if the ant is dead then exit the method
    if (!this.alive) {
      return;
    }


    //apply all the rules in order
    for (let i=0; i < this.rules.length; i++) {
      if (this.rules[i].matches(map, this.pos, this.direction)) {
        //rotate the direction based on the active rule
        if (!eightDirections) {
          this.direction = (this.direction + this.rules[i].turn) % 4;
        } else {
          this.direction = (this.direction + this.rules[i].turn) % 8;
        }


        //change the tile type 
        map[this.pos.x][this.pos.y].setTile(this.rules[i].newType, this);
        //add the new tile to the list of tiles it's changed
        this.claimed.push(map[this.pos.x][this.pos.y]);


        //draw changed tiles
        if (displayColor) {
          //draw the new tiles as the color of the ant
          fill(this.hue, 255, 255, opacity);
          //fill(hue, 255, (tiles[pos.x][pos.y].type+1)*255/tileTypes,opacity);
        } else {
          //draw the new tiles as their real color
          fill(tiles[this.pos.x][this.pos.y].type*255/tileTypes, opacity);
        }
        noStroke();
        rect(this.pos.x*zoom, this.pos.y*zoom, Math.max(zoom,1), Math.max(zoom,1));


        break;
      }
    }


    //move in the direction the ant is facing
    if (!eightDirections) {
      //four directional movement
      if (this.direction == 0) {
        this.pos.x++;
      } else if (this.direction == 1) {
        this.pos.y++;
      } else if (this.direction == 2) {
        this.pos.x--;
      } else if (this.direction == 3) {
        this.pos.y--;
      }
    } else {
      //eight directional movement
      if (this.direction == 0) {
        this.pos.x++;
      } else if (this.direction == 1) {
        this.pos.x++;
        this.pos.y++;
      } else if (this.direction == 2) {
        this.pos.y++;
      } else if (this.direction == 3) {
        this.pos.y++;
        this.pos.x--;
      } else if (this.direction == 4) {
        this.pos.x--;
      } else if (this.direction == 5) {
        this.pos.y--;
        this.pos.x--;
      } else if (this.direction == 6) {
        this.pos.y--;
      } else if (this.direction == 7) {
        this.pos.y--;
        this.pos.x++;
      }
    }


    //if it goes off the map's edge loop it around to the other side
    if (this.pos.x < 0) {
      this.pos.x = map.length-1;
    }
    if (this.pos.x >= map.length) {
      this.pos.x = 0;
    }
    if (this.pos.y < 0) {
      this.pos.y = map[this.pos.x].length-1;
    }
    if (this.pos.y >= map[this.pos.x].length) {
      this.pos.y = 0;
    }


    //if it is on food eat the food and make a child
    if (map[this.pos.x][this.pos.y].type == tileTypes) {
      map[this.pos.x][this.pos.y].type = 0;
      spawnAnt(ants, this, this.pos);


      //re-draw the food tile as empty
      fill(0, opacity);
      noStroke();
      rect(this.pos.x * zoom, this.pos.y * zoom, Math.max(zoom, 1), Math.max(zoom, 1));
    }


    //cause ant to age
    this.age--;
    //cause ant to age faster depending on the amount of empty tiles around it, this makes it harder for ants to spread
    //keep in mind food only spawns in tiles with space around them
    this.age -= abs(getSurround(map, 0));


    //if it's age reaches 0 kill the ant
    if (this.age < 0) {
      this.alive = false;


      //if the ant is on a tile it is weak to die
    } else if (map[this.pos.x][this.pos.y].die(this, this.weakness)) {
      this.alive = false;
    }
  }


  //get the number of a tile around the ant of a certain type
  getSurround(grid, fType) {
    let total=0;
    for (let tx=-2; tx<=2; tx++) {
      for (let ty=-2; ty<=2; ty++) {
        let x = pos.x+tx;
        let y = pos.y+ty;
        if (x < 0) {
          x=x+grid.length;
        }
        if (x>=grid.length) {
          x=x-grid.length;
        }
        if (y < 0) {
          y = y + grid[0].length;
        }
        if (y>=grid[0].length) {
          y = y - grid[0].length;
        }
        if (grid[x][y].type == fType || grid[x][y].type == tileTypes) {
          total++;
        }
      }
    }
    return total;
  }


  //kill the ant
  //redraws all the tiles the ant has covered as dead tiles and resets their owner
  die() {
    noStroke();
    this.claimed.forEach(t => {
      //if the ant still owns the tile reset and redraw the tile
      if (t.isOwner(this)) {
        t.resetTile();
        if(redrawDead){
          fill(t.type*255/tileTypes);
          rect(t.pos.x*zoom, t.pos.y*zoom, Math.max(zoom,1), Math.max(zoom,1));
        }
      }
    });
  }
}


//the tiles the map is made of, act as the environment
class Tile {
  // //the type of tile
  // int type;
  // //the last alive ant to change the tile
  // Ant owner;
  // //position of the tile
  // Vector pos;

  constructor(t, p) {
    this.pos = p;
    this.owner = null;
    this.type = t;   
  }

  //have an ant change the tile type
  setTile(t, o) {
    this.type = t;
    this.owner = o;
  }


  //reset the tile owner
  resetTile() {
    this.owner=null;
    //unused to set tile back to being empty
    //type=0;
  }


  //check if an ant is the owner
  isOwner(test) {
    if (this.owner === null) {
      return false;
    }
    return test === this.owner;
  }


  //check it the tile has an alive owner
  claimed() {
    return this.owner != null && this.owner.alive;
  }


  //check if an ant will die on this tile
  die(test, weakness) {
    if (this.type != weakness) {
      return false;
    }
    if (this.owner == null) {
      return true;
    }
    return test != this.owner;
  }
}




//---------------------------------




// //the map of all tiles
let tiles = [[]];


// //all alive ants
let ants = [];


// //how much the camera is zoomed in
let zoom = 1;


function setup(params) {
  createCanvas(windowWidth, windowHeight);
  //set color to use hue
  colorMode(HSB, 100);


  //setup map to size of screen
  // tiles=new Tile[Math.floor(windowWidth)][Math.floor(height)];
  tiles = new Array(Math.floor(width/zoom));
  for (let x = 0; x < tiles.length; x++) {
    tiles[x] = new Array(Math.floor(height/zoom));
    for (let y = 0; y < tiles[x].length; y++) {
      tiles[x][y] = new Tile(0, new Vector(x, y));
    }
  }


  //spawn starting random ants
  for (let index = 0; index < 5000; index++) {
    spawnRandomAnt(ants);
  }


  //draw starting tiles
  background(0);
  /*for (int x=0; x<tiles.length; x++) {
    for (int y=0; y<tiles[x].length; y++) {
      fill(tiles[x][y].type*255/tileTypes);
      noStroke();
      rect(x*zoom, y*zoom, Math.max(zoom,1), Math.max(zoom,1));
    }
  }*/


  //set framerate really high so it'll max out
  frameRate(600);
}


function draw() {
  //fade screen to black if fade is on
  if (fade > 0) {
    fill(0, fade);
    noStroke();
    rect(0, 0, width, height);
  }


  //try to spawn up to a number of new food tiles
  for (let i = 0; i < 100; i++) {
    spawnFood(tiles);
  }


  //move all ants
  for (let i = 0; i < ants.length; i++) {
    ants[i].move(tiles);
  }


  //remove and kill all dead ants
  for (let i = ants.length-1; i >= 0; i--) {
    if (!ants[i].alive) {
      ants[i].die();
      ants.splice(i,1);
    }
  }
}




// //-------------General Methods-------------




//spawns food onto the map
function spawnFood(grid) {
  //if the tile was successfully placed
  let placed=false;
  //the number of times it will attempt to place the food
  let tries=100;
  while (!placed && tries > 0) {
    //how many more times it will try to place the food
    tries--;


    let x, y;
    //spawn food
    if (!foodDisk) {
      //spawn food in square
      x = Math.floor(random(0, tiles.length));
      y = Math.floor(random(0, tiles[0].length));
    } else {
      //spawning food in a circle
      let d = random(0, width/zoom/2);
      let a = random(0, TWO_PI);
      x = Math.floor(cos(a) * d) + (Math.floor(width/zoom/2));
      y = Math.floor(sin(a) * d) + (Math.floor(height/zoom/2));
    }


    //if food somehow spawns out of bounds loop it around back into bounds
    if ( x < 0) {
      x = x + grid.length;
    }
    if (x >= grid.length) {
      x = x - grid.length;
    }
    if (y < 0) {
      y = y + grid[0].length;
    }
    if (y >= grid[0].length) {
      y = y - grid[0].length;
    }


    //calculate using a simple set of rules if the food can spawn at this position
    //this is based on the amount of air around the tile


    if (multiBiome) {
      //rules vary over space creating multiple biomes
      let surr = getSurround(tiles, 0, new Vector(x, y), 4);
      if (grid[x][y].type == 0 && (surr/zoom > x / 10 && surr/zoom < x / 10 + y / 10)) {
        //if the food can spawn then replace the tile with food
        grid[x][y].resetTile();
        grid[x][y].type=tileTypes;
        //draw the food optionally
        if (displayFood) {
          fill(100, 255, 150,opacity);
          noStroke();
          rect(x*zoom, y*zoom, Math.max(zoom,1), Math.max(zoom,1));
        }
        //set flag that the tile was placed
        placed = true;
      }
    } else {
      //simpler single biome ruleset
      let surr = getSurround(tiles, 0, new Vector(x, y), 2)+getSurround(tiles, tileTypes, new Vector(x, y), 2);
      if (grid[x][y].type == 0 && surr > 20 && surr < 25) {
        //if the food can spawn then replace the tile with food
        grid[x][y].resetTile();
        grid[x][y].type = tileTypes;
        //draw the food optionally
        if (displayFood) {
          fill(100, 255, 150);
          noStroke();
          rect(x*zoom, y*zoom, Math.max(zoom, 1), Math.max(zoom, 1));
        }
        //set flag that the tile was placed
        placed = true;
      }
    }
  }
}


//get the number of tiles surrounding a tile
function getSurround(grid, fType, pos, range) {
  let total = 0;
  for (let tx=-range; tx <= range; tx++) {
    for (let ty=-range; ty <= range; ty++) {
      let x = pos.x + tx;
      let y = pos.y + ty;
      if (x < 0) {
        x = x + grid.length;
      }
      if (x >= grid.length) {
        x = x - grid.length;
      }
      if (y < 0) {
        y = y + grid[0].length;
      }
      if (y >= grid[0].length) {
        y = y - grid[0].length;
      }
      if (grid[x][y].type==fType) {
        total++;
      }
    }
  }
  return total;
}


//spawn new ants
function spawnRandomAnt(antArray) {
  antArray.push(new Ant(new Vector(Math.floor(random(0, tiles.length)), Math.floor(random(0, tiles[0].length)))));
}
function spawnFromRandom(antArray) {
  let id=Math.floor(random(0, options.length));
  spawnAnt(antArry, antArray[id], antArray[id].pos);
}
function spawnAnt(antArray, parAnt, pos) {
  antArray.push(new Ant(pos, parAnt));
  antArray[ants.length-1].mutate();
}