/* tslint:disable */
import {
  GeoPoint
} from '../index';

declare var Object: any;
export interface HsyListingInterface {
  content?: any;
  imageIds?: Array<string>;
  lastUpdated?: Date;
  location?: GeoPoint;
  ownerId: string;
  price?: number;
  title?: string;
  type?: number;
  uid: string;
}

export class HsyListing implements HsyListingInterface {
  content: any = <any>null;
  imageIds: Array<string> = <any>[];
  lastUpdated: Date = new Date(0);
  location: GeoPoint = <any>null;
  ownerId: string = '';
  price: number = 0;
  title: string = '';
  type: number = 0;
  uid: string = '';
  constructor(data?: HsyListingInterface) {
    Object.assign(this, data);
  }
  /**
   * The name of the model represented by this $resource,
   * i.e. `HsyListing`.
   */
  public static getModelName() {
    return "HsyListing";
  }
  /**
  * @method factory
  * @author Jonathan Casarrubias
  * @license MIT
  * This method creates an instance of HsyListing for dynamic purposes.
  **/
  public static factory(data: HsyListingInterface): HsyListing{
    return new HsyListing(data);
  }  
  /**
  * @method getModelDefinition
  * @author Julien Ledun
  * @license MIT
  * This method returns an object that represents some of the model
  * definitions.
  **/
  public static getModelDefinition() {
    return {
      name: 'HsyListing',
      plural: 'HsyListings',
      properties: {
        content: {
          name: 'content',
          type: 'any'
        },
        imageIds: {
          name: 'imageIds',
          type: 'Array&lt;string&gt;'
        },
        lastUpdated: {
          name: 'lastUpdated',
          type: 'Date'
        },
        location: {
          name: 'location',
          type: 'GeoPoint'
        },
        ownerId: {
          name: 'ownerId',
          type: 'string'
        },
        price: {
          name: 'price',
          type: 'number'
        },
        title: {
          name: 'title',
          type: 'string'
        },
        type: {
          name: 'type',
          type: 'number'
        },
        uid: {
          name: 'uid',
          type: 'string'
        },
      },
      relations: {
      }
    }
  }
}
