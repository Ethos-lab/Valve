# Valve

## Hello Retail


[Hello-Retail](https://github.com/Nordstrom/hello-retail) is an award winning serverless, event-driven retail application prototype developed by Nordstrom Technologies.


Being a serverless application, it fits our need for a demo application for evaluating Valve.


We have implemented the variant of Hello-Retail that is implemented by Apernas et al. in the paper: "*Secure serverless computing using dynamic information flow control*".


They have made some changes to the structure of hello-retail.

As per their repository, there are variants of hello-retail:

1. Structurally modified hello-retail, which we'll call *vanilla-hello-retail*

2. Hello-retail ported to Trapeze, a system proposed in their paper, which we'll call *trapeze-hello-retail*


We have modified the vanilla-trapeze-hello-retail, to make it run with Valve. We'll call this variant *vanilla-trapeze-hello-retail*.



To sum up, there are 3 variants in our work:



1. vanilla-hello-retail


2. trapeze-hello-retail


3. valve-hello-retail


### Flows in hello-retail


There are three main flows in Hello Retail, all of which are present in the 3 variants mentioned above:



1. productCatalogApi



    * api



    * builder



2. product-photos



    * 1.assign



    * 2.message


    * 2.record



    * 3.receive



    * 4.success


    * 6.report 


3. product-purchase


    *  1.authenticate


    * 2.getPrice



    * 3.authorize-cc



    * 4.publish


### Setup and execution:

1. Setup a Kubernetes cluster



2. Deploy the sql service:\



    * Navigate to mysql:



      ```



      kubectl apply -f mySqlDeployment.yml



      kubectl apply -f mysql-pv.yml



      ```



    * Start a mysql client:


      ```

      kubectl run -it --rm --image=mysql:5.6 mysql-client -- mysql -h mysql -ppassword

      ```


    * Create user and grant priviledge. Add database


      ```

      create user 'abc'@% IDENTIFIED BY 'xyz';

      create user 'abc'@'%' IDENTIFIED BY 'xyz';

      create database helloRetail;

      ```



3. Deploy the functions\

  * Deploy a function, look below for example:
    ```
    cd vanilla-hello-retail/productCatalogApi/builder/
    faas-cli up -f product-catalog-builder.yml 
    ```

  * Call the function, we provide a sample input json in the same folder as the function yml.


    ```
    curl -d @sample-input-product.json -H "Content-Type: application/json" -X POST 'http://192.168.99.101:31112/function/product-catalog-builder/product'
    ```
