export class FreeSoundSearcher {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    // Método para realizar la búsqueda
    async buscar(query, page = 1, resultsPerPage = 40) {
        try {
            // Construir la URL de la solicitud de búsqueda
            const url = `https://freesound.org/apiv2/search/text/?query=${query}&token=${this.apiKey}&page=${page}&page_size=${resultsPerPage}`;
            
            // Realizar la solicitud GET utilizando fetch()
            const response = await fetch(url);
            
            // Verificar si la respuesta es exitosa
            if (!response.ok) {
                throw new Error('No se pudo realizar la solicitud');
            }
            
            // Convertir la respuesta a formato JSON
            const data = await response.json();
            const totalResults = data.count;

            // Devolver los resultados de la búsqueda
            return { resultados: data.results, total: totalResults };
            
        } catch (error) {
            console.error('Error al realizar la búsqueda:', error);
            return { resultados: [], total: 0 }; // Devolver un array vacío y total 0 en caso de error
        }
    }
}