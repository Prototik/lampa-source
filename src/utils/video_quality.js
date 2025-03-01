import Storage from './storage'
import Reguest from './reguest'
import Arrays from './arrays'

let data     = []
let token    = '3i40G5TSECmLF77oAqnEgbx61ZWaOYaE'
let network  = new Reguest()
let videocdn = 'http://cdn.svetacdn.in/api/short?api_token='+token
let object   = false

/**
 * Запуск
 */
function init(){
    data = Storage.cache('quality_scan',300,[])

    data.filter(elem=>!elem.title).forEach(elem=>{
        Arrays.remove(data,elem)
    })

    setInterval(extract,30*1000)
}

/**
 * Добавить карточку для парсинга
 * @param {[{id:integer, title:string, imdb_id:string}]} elems - карточки
 */
function add(elems){
    elems.filter(elem=>!(elem.number_of_seasons || elem.seasons)).forEach(elem=>{
        let id = data.filter(a=>a.id == elem.id)

        if(!id.length && elem.title && typeof elem.id == 'number'){
            data.push({
                id: elem.id,
                title: elem.title,
                imdb_id: elem.imdb_id
            })
        } 
    })

    Storage.set('quality_scan',data)
}

/**
 * Начать парсить качество
 * @param {{id:integer, title:string, imdb_id:string}} itm - карточка
 */
function search(itm){
    let url  = 'http://cdn.svetacdn.in/api/'
    let type = itm.iframe_src.split('/').slice(-2)[0]

    if(type == 'movie') type = 'movies'

    url += type

    url = Lampa.Utils.addUrlComponent(url,'api_token='+token)
    url = Lampa.Utils.addUrlComponent(url,itm.imdb_id ? 'imdb_id='+encodeURIComponent(itm.imdb_id) : 'title='+encodeURIComponent(itm.title))
    url = Lampa.Utils.addUrlComponent(url,'field='+encodeURIComponent('global'))

    network.timeout(4000)
    network.silent(url, (found) => {
        let results = found.data.filter(elem=>elem.id == itm.id)

        let qualitys = ['ts','camrip','webdl','dvdrip','hdrip','bd']
        let index    = 0

        if(results.length && results[0].media){
            results[0].media.map((m)=>{
                index = Math.max(index, qualitys.indexOf(m.source_quality))
                
                object.quality = qualitys[index]
            })
        }

        save()
    },save)
}

/**
 * Найти фильм по imdb_id или титлу
 * @param {string} imdb_id 
 * @param {string} query 
 */
function req(imdb_id, query){
    let url  = videocdn + '&' + (imdb_id ? 'imdb_id=' + encodeURIComponent(imdb_id) : 'title='+encodeURIComponent(query))

    network.timeout(1000*15)
    
    network.silent(url,(json)=>{
        if(json.data && json.data.length){
            if(object.imdb_id){
                let imdb = json.data.filter(elem=>elem.imdb_id == object.imdb_id)

                if(imdb.length) json.data = imdb
            }

            if(json.data.length){
                return search(json.data[0])
            }
        }

        save()
    },save)
}

/**
 * Получить карточку которую нужно парсить
 */
function extract(){
    let ids = data.filter(e=>!e.scaned && (e.scaned_time || 0) + (60 * 60 * 12 * 1000) < Date.now())

    if(ids.length){
        object = ids[0]

        if(object.title){
            if(object.imdb_id){
                req(object.imdb_id)
            } 
            else{
                let dom = Storage.field('proxy_tmdb') ? 'apitmdb.cub.watch/3/' : 'api.themoviedb.org/3/'

                network.silent('http://'+dom+'movie/' + object.id + '/external_ids?api_key=4ef0d7355d9ffb5151e987764708ce96&language=ru', function (ttid) {
                    req(ttid.imdb_id, object.title)
                },save)
            }
        }
        else{
            Arrays.remove(data,object)
        }
    }
    else{
        data.forEach(a=>a.scaned = 0)
    }

    Storage.set('quality_scan',data)
}

/**
 * Сохранить состояние
 */
function save(){
    if(object){
        object.scaned = 1
        object.scaned_time = Date.now()

        Storage.set('quality_scan',data)
    }
}

/**
 * Получить качество фильма если есть
 * @param {{id:integer}} elem - карточка
 * @returns {string}
 */
function get(elem){
    let fid = data.filter(e=>e.id == elem.id)

    return (fid.length ? fid[0] : {}).quality
}

export default {
    init,
    get,
    add
}