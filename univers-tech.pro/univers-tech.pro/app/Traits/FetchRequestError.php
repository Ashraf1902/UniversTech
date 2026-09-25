<?php
namespace App\Traits;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

trait FetchRequestError{

    //function for make handle to request errors as json messagw
    protected function failedValidation(Validator $validator)
    {
        throw new HttpResponseException(
            SendResponse(
                data: $validator->errors(),
                message: "error in body request",
                status: 422
            )
        );
    }//end failedValidation   

}//end FetchRequestError

