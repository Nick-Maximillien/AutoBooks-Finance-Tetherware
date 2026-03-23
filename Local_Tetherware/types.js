// types.ts
export interface Product {
    id: string;
    name: string;
    price: number;
    image: string;
  }
  
  export interface CartItem extends Product {
    quantity: number;
  }