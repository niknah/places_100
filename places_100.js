import axios from 'axios';
import 'dotenv/config';
import {toXML} from "to-xml";
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

/* globals Promise */


const API_KEY = process.env.GOOGLE_MAPS_API;

class NearBy {
  constructor() {
    this.blockSize = 0.1;
    this.lngTotal  = 10;
    this.latTotal  = 30;
    this.allJson = './places_100.json';
    this.verbose = false;
    this.minUserRatings = 100;
    this.minRating = 4.4;
    this.searchType='restaurant';
  }


  async request(lat,lng, next_page_token) {
    // fields=vicinity,name,rating,user_ratings_total,type,geometry/location,price_level,place_id&
    let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&type=${this.searchType}&rankby=distance&key=${API_KEY}`;
    if (next_page_token) {
      url=`https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${encodeURIComponent(next_page_token)}&key=${API_KEY}`;
    }

    if(this.verbose) {
      console.log('url',url);
    }
    const response = await axios.get(url);
    if(this.verbose) {
      console.log('response',response.data);
    }
    return response.data;
  }

  async printPlacemarks() {
    const data = {
      'kml': {
        '@xmlns':"http://www.opengis.net/kml/2.2",
        'Document': {
          'Style':this.styles,
          'StyleMap':this.styleMaps,
          'Placemark': Object.values(this.placemarks),
        }
      },
    };

    console.log('<?xml version="1.0" encoding="UTF-8"?>');
    console.log(toXML(data, null, 2));

    fs.writeFile('./places_100.json', JSON.stringify(this.allResults,null,4), err => {
      if (err) {
        console.error(err);
      } else {
        // file written successfully
      }
    });
  }

  async findPlacemarks(latStart, lngStart) {
    this.styles=[];
    this.styleMaps=[];
    const addStyle = (id, color) => {
      const styleObj = this.getStyle(id, color);
      this.styles = this.styles.concat(styleObj.Style);
      this.styleMaps.push(styleObj.StyleMap);
      return '#'+id;
    }
    this.iceCreamId = addStyle('icon-1607-0288D1-nodesc', 'ffd18802');
    this.barId = addStyle('icon-1879-0F9D58-nodesc', 'ff589d0f');
    this.foodId = addStyle('icon-1577-0F9D58-nodesc', 'ff589d0f');

    this.styleUrls = {
      bar: this.barId,
      ice_cream_shop: this.iceCreamId,
    };

    this.placemarks = {};
    this.allResults = {};
    try {
      await fsPromises.access(this.allJson, fs.constants.R_OK | fs.constants.W_OK);
      this.allResults = JSON.parse(await fsPromises.readFile(this.allJson));
      Object.values(this.allResults).filter(
        (result) => this.addPlacemark(result, {foundNew:0, foundDupe:0})
      );
    } catch(e) {
      console.error(e);
    }

    let latCount = 0;
    if(this.verbose) {
      console.log('blocks lat',this.latTotal,'lng',this.lngTotal);
    }
    for(let lat = latStart; latCount++ < this.latTotal ; lat -= (0.0090*this.blockSize)) {
      let lngCount = 0;
      for(let lng = lngStart; lngCount++ < this.lngTotal ; lng += (0.0090*this.blockSize)) {
        await this.getPlacemarks(lat, lng);
      }
    }
  }

  addPlacemark(result, founds) {
    if (!result.rating || !result.user_ratings_total
      || result.rating < this.minRating
      || result.user_ratings_total < this.minUserRatings
    ) {
      return null;
    }

    let styleUrl;
    for(const type of result.types) {
      styleUrl = this.styleUrls[type];
      if(styleUrl) {
        break;
      }
    }

    if (!styleUrl) {
      styleUrl = this.foodId;
    }
    const placemark = {
      'name':result.name,
      styleUrl,
      description: result.vicinity,
      'Point':{
        'coordinates':`${result.geometry.location.lng},${result.geometry.location.lat},0`,
      },
      'ExtendedData':{
        'Data': [
          {
            '@name': 'rating',
            'value': result.rating,
          },
          {
            '@name': 'price_level',
            'value': result.price_level,
          },
          {
            '@name': 'user_ratings_total',
            'value': result.user_ratings_total,
          },
        ]
      }
    };
    if (!this.placemarks[result.place_id]) {
      founds.foundNew++;
    } else {
      founds.foundDupe++;
    }
    this.placemarks[result.place_id]=placemark;
    return placemark;
  }

  async getPlacemarks(lat,lng) {
    let page = 0;
    let next_page_token = undefined;
    const founds = {foundNew:0, foundDupe:0};
    for(;;) {
      const resultsObj = await this.request(lat,lng,next_page_token);
      next_page_token = resultsObj.next_page_token;
      const results = resultsObj.results;

      for(const result of results) {
        this.allResults[result.place_id] = result;
        this.addPlacemark(result, founds);
      }

      if (!next_page_token) {
        break;
      }
      ++page;
      await new Promise((done) => { setTimeout(done, 1000); } );
    }
    if(founds.foundDupe === 0) {
      console.error('no dupes found',lat,lng);
    }
    if(founds.foundNew === 0) {
      console.error('found nothing new',lat,lng);
    }
    if(this.verbose && page>1) {
      console.log(lat,lng,'pages',page);
    }
  }

  getStyle(name, color) {
    return {
      'Style':[
        {
          '@id':`${name}-normal`,
          'IconStyle':{
            color,
            scale:1,
            Icon:{
              'href':'https://www.gstatic.com/mapspro/images/stock/503-wht-blank_maps.png'
            }
          }
        },
        {
          '@id':`${name}-highlight`,
          'IconStyle':{
            color,
            scale:1,
            Icon:{
              'href':'https://www.gstatic.com/mapspro/images/stock/503-wht-blank_maps.png'
            }
          }
        },
      ],
      'StyleMap':{
        '@id':name,
        'Pair': [
          { 
            'key':'normal',
            'styleUrl':`#${name}-normal`,
          },
          {
            'key':'highlight',
            'styleUrl':`#${name}-highlight`,
          }
        ]
      }
    }
  }

}


async function main() {

  // yargs does not process values with - at the start.
  const okLocationArgv = process.argv.map((a) => {
    if(/^[0-9,\.\-]+$/.exec(a)) {
      a = " "+a;
    }
    return a;
  });

  const options = yargs(hideBin(okLocationArgv))
    .option('block-size', {
      type: 'number',
      description: 'Block size in kms, 0.1 = 100m. 1km = 0.0090 lat/lng'
    })
    .option('blocks', {
      type: 'string',
      description: "10x30 means 10 blocks wide(longitude), 30 blocks high(latitude). Each search may use multiple Google API requests, there is a maximum of 20 per page."
    })
    .option('location', {
      type: 'string',
      description: "lat,lng start location. If there is a negative number, add a space at the start so it doesn't think that it's an option. Example: --location ' -33.85441,151.2012'"
    })
    .option('min-rating', {
      type: 'number',
      description: "Minimun rating to include in map"
    })
    .option('min-user-ratings', {
      type: 'number',
      description: "Minimun rating to include in map"
    })
    .option('search-type', {
      type: 'string',
      description: "Defaults to restaurant"
    })
    .option('verbose', {
      type: 'boolean',
      description: "Verbose"
    })
    .strict(true)
    .parse();

  const nearBy=new NearBy();
  nearBy.verbose = options.verbose;
  nearBy.blockSize = options.blockSize || 0.5;
  if(options.blocks) {
    const blocksArr = options.blocks.split('x');
    nearBy.lngTotal = blocksArr[0] || 10;
    nearBy.latTotal = blocksArr[1] || 10;
  }
  if(options.minUserRatings) {
    nearBy.minUserRatings = options.minUserRatings;
  }
  if(options.minRating) {
    nearBy.minRating = options.minRating;
  }
  if(options.searchType) {
    nearBy.searchType = options.searchType;
  }
  let startLocation = [-33.85441,151.2012]; // top left of CBD
  if(options.location) {
    startLocation = options.location.split(',');
  }
  await nearBy.findPlacemarks(parseFloat(startLocation[0]), parseFloat(startLocation[1]));
  nearBy.printPlacemarks();

}

main();
