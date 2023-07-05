import React from "react"

export interface NumberResultsProps {
	numberOfResults: number | undefined;
}

export default function NumberResults(props: NumberResultsProps){
	const conversion = (numberToConvert: number | undefined): string => {
		if(numberToConvert){
			return numberToConvert.toLocaleString();
		}else{
			return '0'
		}
	}

	return (
		<div id="numberResultsContainer">
			<p id="numberResults">{conversion(props.numberOfResults)}</p>
			<p id="resultTag">{props.numberOfResults === 1 ? 'result' : 'results'}</p>
		</div>
	)
}